'use strict';

var commands = {
  windows: '%ProgramFiles(x86)%\\VideoLAN\\VLC\\vlc.exe',
  mac: 'open -a VLC',
  linux: 'vlc'
};

commands.tag = 'vlc';

commands.guess = () => {
  if (navigator.platform.startsWith('Win')) {
    return commands.windows;
  }
  if (navigator.platform.startsWith('Linux')) {
    return commands.linux;
  }
  return commands.mac;
};
