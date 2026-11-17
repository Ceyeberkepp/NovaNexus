import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pg from "pg";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "16kb" }));
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: true } : undefined });
const isProd = process.env.NODE_ENV === "production";
const cookieName = "novanexus_session";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const hashToken = value => crypto.createHash("sha256").update(value).digest("hex");
const hashPassword = password => {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(password, salt, 64).toString("hex");
};
const passwordMatches = (password, stored) => {
  if (!stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  if (!/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(expected)) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex"));
};
const getCookies = req => Object.fromEntries((req.headers.cookie || "").split(";").map(x => x.trim()).filter(x => x.includes("=")).map(x => { const i=x.indexOf("=");return [x.slice(0,i), x.slice(i+1)]; }));
const cookieOptions = { httpOnly: true, secure: isProd, sameSite: "strict", path: "/", maxAge: MAX_AGE_MS };
app.use("/api", (req,res,next) => {
  res.setHeader("Cache-Control","no-store");
  if (!["GET","HEAD","OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (origin) {
      try { if (new URL(origin).host !== host) return res.status(403).json({error:"Origin rejected"}); }
      catch { return res.status(403).json({error:"Origin rejected"}); }
    } else if (req.headers["sec-fetch-site"] && !["same-origin","none"].includes(req.headers["sec-fetch-site"])) {
      return res.status(403).json({error:"Cross-site request rejected"});
    }
    if (req.headers["content-type"]?.split(";")[0] !== "application/json") return res.status(415).json({error:"JSON required"});
  }
  next();
});
async function authenticate(req,res,next) {
  try {
    const token=getCookies(req)[cookieName];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({error:"Sign in required"});
    const result=await pool.query("SELECT u.id,u.name,u.email,u.role,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.active=TRUE",[hashToken(token)]);
    if (!result.rowCount) return res.status(401).json({error:"Session expired"});
    req.user=result.rows[0]; if(req.user.must_change_password && !req.path.endsWith('/auth/change-password')) return res.status(403).json({error:'Password change required',must_change_password:true}); next();
  } catch(e) { next(e); }
}
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many attempts. Try again later."}});
app.post("/api/auth/login",loginLimiter,async(req,res,next)=>{
  try {
    const {email,password,setupCode}=req.body || {};
    if(typeof email!=="string" || typeof password!=="string" || email.length>254 || password.length>1024) return res.status(400).json({error:"Invalid credentials"});
    const result=await pool.query("SELECT id,name,email,role,password_hash,must_change_password FROM users WHERE (lower(email)=lower($1) OR (lower($1)='admin' AND lower(email)='admin@local.invalid')) AND active=TRUE",[email.trim()]);
    const user=result.rows[0];
    if (!user || !passwordMatches(password,user.password_hash)) return res.status(401).json({error:"Invalid credentials"});
    if(user.must_change_password && (!process.env.BOOTSTRAP_SETUP_CODE || typeof setupCode !== "string" || setupCode.length>256 || !crypto.timingSafeEqual(Buffer.from(hashToken(setupCode)),Buffer.from(hashToken(process.env.BOOTSTRAP_SETUP_CODE))))) return res.status(401).json({error:"Initial setup code required"});
    const token=crypto.randomBytes(32).toString("hex");
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '8 hours')",[hashToken(token),user.id]);
    res.cookie(cookieName,token,cookieOptions);
    res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role,must_change_password:user.must_change_password}});
  } catch(e){ next(e); }
});
app.get("/api/auth/me",async(req,res,next)=>{
  try {
    const token=getCookies(req)[cookieName];
    if(!token || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({error:"Sign in required"});
    const result=await pool.query("SELECT u.id,u.name,u.email,u.role,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.active=TRUE",[hashToken(token)]);
    if(!result.rowCount) return res.status(401).json({error:"Session expired"});
    res.json({user:result.rows[0]});
  } catch(e){next(e);}
});
app.post("/api/auth/change-password",authenticate,loginLimiter,async(req,res,next)=>{
  try {
    const {currentPassword,newPassword,setupCode}=req.body || {};
    if(typeof currentPassword!=="string" || typeof newPassword!=="string" || newPassword.length<16 || newPassword.length>1024 || newPassword==="admin" || newPassword===currentPassword) return res.status(400).json({error:"Choose a different password with at least 16 characters"});
    const result=await pool.query("SELECT password_hash,must_change_password FROM users WHERE id=$1",[req.user.id]);
    const stored=result.rows[0];
    if(!stored || !passwordMatches(currentPassword,stored.password_hash)) return res.status(401).json({error:"Current password incorrect"});
    if(stored.must_change_password && (!process.env.BOOTSTRAP_SETUP_CODE || typeof setupCode!=="string" || setupCode.length>256 || !crypto.timingSafeEqual(Buffer.from(hashToken(setupCode)),Buffer.from(hashToken(process.env.BOOTSTRAP_SETUP_CODE))))) return res.status(401).json({error:"Initial setup code required"});
    await pool.query("UPDATE users SET password_hash=$1,must_change_password=FALSE WHERE id=$2",[hashPassword(newPassword),req.user.id]);
    await pool.query("DELETE FROM sessions WHERE user_id=$1",[req.user.id]);
    res.clearCookie(cookieName,{path:"/",httpOnly:true,secure:isProd,sameSite:"strict"});
    res.json({ok:true,reauthenticate:true});
  } catch(e){next(e);}
});
app.post("/api/auth/logout",async(req,res,next)=>{
  try {
    const token=getCookies(req)[cookieName];
    if(token) await pool.query("DELETE FROM sessions WHERE token_hash=$1",[hashToken(token)]);
    res.clearCookie(cookieName,{path:"/",httpOnly:true,secure:isProd,sameSite:"strict"});
    res.json({ok:true});
  } catch(e){next(e);}
});
app.get("/api/health",async(req,res)=>{try{await pool.query("SELECT 1");res.json({status:"ok"});}catch{res.status(503).json({status:"unavailable"});}});
app.get("/api/users",authenticate,async(req,res,next)=>{
  try { const r=await pool.query("SELECT id,name,email,role FROM users WHERE active=TRUE ORDER BY name LIMIT 500");res.json({users:r.rows}); } catch(e){next(e);}
});
app.post("/api/users",authenticate,async(req,res,next)=>{
  if(req.user.role!=="Admin") return res.status(403).json({error:"Administrator required"});
  const {name,email,password}=req.body || {};
  if(typeof name!=="string"||name.trim().length<2||name.length>120||typeof email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=="string"||password.length<14||password.length>1024) return res.status(400).json({error:"Valid name, email and password (14+ characters) required"});
  try { const r=await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,lower($2),$3,'Regular') RETURNING id,name,email,role",[name.trim(),email.trim(),hashPassword(password)]);res.status(201).json({user:r.rows[0]}); }
  catch(e){ if(e.code==="23505")return res.status(409).json({error:"Email already exists"});next(e); }
});
app.use("/api",(req,res)=>res.status(404).json({error:"API endpoint not available"}));
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../dist");
if(fs.existsSync(dist)) {
  app.use(express.static(dist,{index:false,immutable:true,maxAge:"1y",setHeaders(res,p){if(p.endsWith(".html"))res.setHeader("Cache-Control","no-store");}}));
  app.get("/{*path}",(req,res)=>res.sendFile(path.join(dist,"index.html")));
}
app.use((err,req,res,next)=>{console.error("Request failed",err?.code||err?.name||"error");if(!res.headersSent)res.status(500).json({error:"Internal server error"});});
async function start() {
  if(!process.env.DATABASE_URL) throw Error("DATABASE_URL is required");
  await pool.query("SELECT 1");
  await pool.query("CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Admin','Regular')), active BOOLEAN NOT NULL DEFAULT TRUE, must_change_password BOOLEAN NOT NULL DEFAULT FALSE)");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL)");
  if(process.env.BOOTSTRAP_SETUP_CODE) {
    if(process.env.BOOTSTRAP_SETUP_CODE.length<24) throw Error("BOOTSTRAP_SETUP_CODE must contain at least 24 characters");
    const existing=await pool.query("SELECT id FROM users WHERE role='Admin' LIMIT 1");
    if(!existing.rowCount) {
      await pool.query("INSERT INTO users(name,email,password_hash,role,must_change_password) VALUES($1,$2,$3,'Admin',TRUE)",["Administrator","admin@local.invalid",hashPassword("admin")]);
      console.log("Initial admin account created; one-time setup code required and password change enforced");
    }
  } else if(process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_PASSWORD) {
    if(process.env.BOOTSTRAP_ADMIN_PASSWORD.length<20) throw Error("Bootstrap password must be at least 20 characters");
    const existing=await pool.query("SELECT id FROM users WHERE role='Admin' LIMIT 1");
    if(!existing.rowCount) await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,lower($2),$3,'Admin')",[process.env.BOOTSTRAP_ADMIN_NAME||"Administrator",process.env.BOOTSTRAP_ADMIN_EMAIL,hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD)]);
  }
  app.listen(Number(process.env.PORT||3000),"0.0.0.0",()=>console.log("NovaNexus listening"));
}
start().catch(e=>{console.error("Startup failed:",e.message);process.exit(1);});
