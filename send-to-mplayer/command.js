'use strict';

var commands = {
  windows: '%ProgramFiles%\\MPlayer\\mplayer.exe -playlist',
  mac: 'open -a "MPlayer OSX Extended" --args -playlist',
  linux: 'mplayer -playlist'
};

commands.tag = 'mplayer';

commands.guess = () => {
  if (navigator.platform.startsWith('Win')) {
    return commands.windows;
  }
  if (navigator.platform.startsWith('Linux')) {
    return commands.linux;
  }
  return commands.mac;
};
