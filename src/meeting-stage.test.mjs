import assert from 'node:assert/strict';
import {selectStage} from './meeting-stage.mjs';

const participant = (identity,isLocal=false)=>({identity,isLocal});
const track=(identity,source,options={})=>({
 participant:participant(identity,options.local||false),
 source,
 ...(options.placeholder?{}:{publication:{isMuted:!!options.muted,track:options.missing?null:{kind:'video'}}})
});
const alice=track('alice','camera');
const bob=track('bob','camera');
const presenter=track('alice','screen_share');
const mutedShare=track('alice','screen_share',{muted:true});
let view=selectStage([alice,bob], [{identity:'bob'}]);
assert.equal(view.mode,'speaker');
assert.equal(view.main,bob);
assert.deepEqual(view.filmstrip,[alice]);
view=selectStage([alice,bob,presenter], [{identity:'bob'}]);
assert.equal(view.mode,'screen');
assert.equal(view.main,presenter);
assert.deepEqual(view.filmstrip,[alice,bob]);
view=selectStage([alice,bob,mutedShare], [{identity:'bob'}]);
assert.equal(view.mode,'speaker');
assert.equal(view.main,bob);
view=selectStage([alice,bob,track('alice','screen_share',{missing:true})], [{identity:'bob'}]);
assert.equal(view.mode,'speaker');
assert.equal(view.main,bob);
view=selectStage([alice,bob], []);
assert.equal(view.main,alice);
view=selectStage([],[]);
assert.equal(view.main,null);
assert.deepEqual(view.filmstrip,[]);
console.log('Screen-share priority, active speaker switching, muted-share fallback and empty-room tests passed.');
