'use strict';

var commands = {
  windows: '%ProgramFiles%\\MPC-HC\\mpc-hc64.exe',
  mac: 'open -a "Media Player Classic" --args',
  linux: 'mpc-hc'
};

commands.tag = 'mpc';

commands.guess = () => {
  if (navigator.platform.startsWith('Win')) {
    return commands.windows;
  }
  if (navigator.platform.startsWith('Linux')) {
    return commands.linux;
  }
  return commands.mac;
};
