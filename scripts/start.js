const os = require('os');
const { spawn } = require('child_process');

/**
 * Resolves the active IPv4 LAN address of the host machine,
 * skipping virtual adapters (VirtualBox, WSL, Hyper-V, vEthernet, loopback).
 * Prioritizes Wi-Fi/WLAN physical connections.
 */
function getLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (/virtual|vbox|loopback|vethernet|wsl|pseudo|vmware/i.test(name)) continue;
    for (const a of addrs) {
      if (
        a.family === 'IPv4' &&
        !a.internal &&
        !a.address.startsWith('192.168.56.') && // VirtualBox host-only
        !a.address.startsWith('169.254.') // APIPA / link-local
      ) {
        const isWiFi = /wi-fi|wlan|wireless/i.test(name);
        candidates.push({ ip: a.address, name, priority: isWiFi ? 1 : 2 });
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates.length > 0 ? candidates[0].ip : null;
}

const passedArgs = process.argv.slice(2);
const isTunnel = passedArgs.includes('--tunnel');

// 1. Resolve active LAN IP address and bind to packager hostname (if not running in tunnel mode)
const lanIp = getLanIp();
if (!isTunnel && lanIp && !process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  console.log(`\x1b[36m[MeetPulse]\x1b[0m Resolved LAN IP: \x1b[32m${lanIp}\x1b[0m`);
}

console.log(`\x1b[90m------------------------------------------------------------\x1b[0m`);
console.log(`\x1b[33m[Tip]\x1b[0m If your phone is on a separate network or college Wi-Fi`);
console.log(`      blocks local devices, run: \x1b[32mnpm run start:tunnel\x1b[0m`);
console.log(`\x1b[90m------------------------------------------------------------\x1b[0m\n`);

// 2. Forward execution to Expo CLI without triggering DEP0190
const expoArgs = ['expo', 'start', ...passedArgs];

let child;
if (process.platform === 'win32') {
  child = spawn(process.env.ComSpec || 'cmd.exe', ['/c', 'npx', ...expoArgs], {
    stdio: 'inherit',
    env: process.env,
  });
} else {
  child = spawn('npx', expoArgs, {
    stdio: 'inherit',
    env: process.env,
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
