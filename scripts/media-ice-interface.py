#!/usr/bin/env python3
"""Safely restrict LiveKit RTC candidate enumeration to a chosen LAN interface.

Only edits a simple top-level rtc block with no pre-existing interfaces filter.
Never outputs keys or secrets; fails closed on ambiguous configuration.
"""
import argparse
import ipaddress
import re
from pathlib import Path

def restrict_rtc(text: str, interface: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_.:-]{1,32}", interface):
        raise ValueError("Invalid interface name")
    lines = text.splitlines(keepends=True)
    blocks = [i for i, line in enumerate(lines) if line.strip() == "rtc:" and line.startswith("rtc:")]
    if len(blocks) != 1:
        raise ValueError("Expected exactly one top-level rtc: configuration")
    start = blocks[0]
    end = next((i for i in range(start + 1, len(lines))
                if lines[i].strip() and not lines[i].startswith((" ", "#", "\t"))), len(lines))
    body = "".join(lines[start+1:end])
    if re.search(r"(?m)^\s+interfaces\s*:", body):
        raise ValueError("An RTC interfaces filter already exists; preserve it for manual review")
    if not re.search(r"(?m)^  (tcp_port|udp_port|use_external_ip)\s*:", body):
        raise ValueError("RTC section looks unexpected; no changes made")
    lines.insert(start + 1, f"  interfaces:\n    includes:\n      - {interface}\n")
    return "".join(lines)

def validate_selected_log(log: str, lan_ip: str) -> bool:
    ipaddress.IPv4Address(lan_ip)
    for line in reversed(log.splitlines()):
        if "using external IPs" not in line:
            continue
        match = re.search(r'"ips":\s*\[([^]]*)\]', line)
        if not match:
            return False
        candidates = re.findall(r'"([^"]+)"', match.group(1))
        local_ip = ipaddress.ip_address(lan_ip)
        local_match = any(item.endswith("/" + lan_ip) or item == lan_ip for item in candidates)
        if not local_match:
            return False
        for item in candidates:
            for part in item.split("/"):
                try:
                    address = ipaddress.ip_address(part)
                except ValueError:
                    return False
                if address.version == 4 and address.is_private and address != local_ip:
                    return False
        return True
    return False

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("prepare")
    build.add_argument("source", type=Path)
    build.add_argument("destination", type=Path)
    build.add_argument("interface")
    check = sub.add_parser("check-log")
    check.add_argument("logfile", type=Path)
    check.add_argument("lan_ip")
    args = parser.parse_args()
    if args.command == "prepare":
        args.destination.write_text(restrict_rtc(args.source.read_text(), args.interface))
    elif args.command == "check-log":
        if not validate_selected_log(args.logfile.read_text(), args.lan_ip):
            raise SystemExit("LiveKit advertised non-LAN private ICE candidates or no valid selection log")
        print("LiveKit candidates selected from the requested LAN interface")

if __name__ == "__main__":
    main()
