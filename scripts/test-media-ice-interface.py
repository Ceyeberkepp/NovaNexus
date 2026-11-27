#!/usr/bin/env python3
"""Offline regression checks for the guarded LiveKit ICE interface repair."""
import importlib.util
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("ice", Path("scripts/media-ice-interface.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

base = """port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
  advertise_internal_ip: true
turn:
  enabled: true
  udp_port: 3478
keys:
  abc: my-private-secret
"""
updated = mod.restrict_rtc(base, "eth0")
assert "rtc:\n  interfaces:\n    includes:\n      - eth0\n" in updated
assert "my-private-secret" in updated
assert "turn:\n  enabled: true" in updated
assert mod.restrict_rtc(base, "ens18").count("interfaces:") == 1
for bad in ("eth0\nkeys:", "docker0/../", ""):
    try:
        mod.restrict_rtc(base, bad)
    except ValueError:
        pass
    else:
        raise AssertionError("Invalid interface accepted")
for bad in (updated, "port: 7880\n", base.replace("rtc:", "other:"), base + "\nrtc:\n  udp_port: 9\n"):
    try:
        mod.restrict_rtc(bad, "eth0")
    except ValueError:
        pass
    else:
        raise AssertionError("Ambiguous RTC config accepted")
good = 'INFO LiveKit using external IPs {"ips": ["24.125.237.168/192.168.0.52", "192.168.0.52/192.168.0.52"], "advertiseInternalIP": true}'
bad = 'INFO LiveKit using external IPs {"ips": ["24.125.237.168/172.17.0.1", "172.18.0.1/172.18.0.1", "192.168.0.52/192.168.0.52"], "advertiseInternalIP": true}'
assert mod.validate_selected_log(good, "192.168.0.52")
assert not mod.validate_selected_log(bad, "192.168.0.52")
assert not mod.validate_selected_log("INFO started server", "192.168.0.52")
with tempfile.TemporaryDirectory() as temp:
    source = Path(temp)/"livekit.yaml"
    output = Path(temp)/"adjusted.yaml"
    source.write_text(base)
    import subprocess, sys
    subprocess.run([sys.executable, "scripts/media-ice-interface.py", "prepare", str(source), str(output), "eth0"], check=True)
    assert source.read_text() == base
    assert output.read_text() == updated
print("ICE interface filter, secret preservation, fail-closed behavior, and candidate-verification regression tests passed")
