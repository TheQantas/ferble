import fuzzysort from 'fuzzysort';

let songIndex: number = -1;
let totalPointsEarned: number = 0;
let totalPointsPossible: number = 0;
let hintsUsed: number = 0;
let isSongPlaying: boolean = false;
let songDurationInterval: number = 0;
let volumeFadeInterval: number = 0;

type HSL = {h:number,s:number,l:number};
type Song = {id:number,title:string,url:string,difficulty:1|2|3|4|5,chorus:number};

const colorDict: {[id:string]:HSL} = {
  'green': {h:120,s:70,l:40},
  'yellow-green': {h:90,s:70,l:45},
  'yellow': {h:60,s:70,l:45},
  'orange': {h:30,s:70,l:50},
  'red': {h:5,s:70,l:45}
};

window.onload = function(): void {
  shuffleArray(songList);
  advanceToNextSong();
  buildSongList();
}

window.onkeydown = function(ev: KeyboardEvent): void {
  if (ev.code == 'Space' && document.activeElement?.tagName != 'INPUT') {
    playPauseSong();
  }
}

//song management

function advanceToNextSong(): void {
  songIndex++;
  if (songIndex >= songList.length) {
    alert('No more songs');
    return;
  } else if (songIndex > 0) { //at least one guess made; update ui total
    (document.getElementById('total-cont') as HTMLElement).innerHTML =
      `Total Points:&nbsp;<b>${totalPointsEarned}/${totalPointsPossible} (${(totalPointsEarned / totalPointsPossible * 100).toFixed(1)}%)</b>`;
  }
  buildSongList();
  hintsUsed = 0;
  const nextSong: Song = songList[songIndex];

  const audioDOM: HTMLAudioElement = document.getElementById('audio-dom') as HTMLAudioElement;
  audioDOM.pause();
  clearInterval(volumeFadeInterval);
  audioDOM.volume = 1;
  audioDOM.src = nextSong.url;
  const diffColor: string = ['green','yellow-green','yellow','orange','red'][nextSong.difficulty-1];
  (document.getElementById('difficulty-dom') as HTMLElement).innerHTML = 
    `Difficulty:&nbsp;<span style="font-weight:bold;color:var(--${diffColor});">${nextSong.difficulty}/5</span>`;
  (document.getElementById('round-dom') as HTMLElement).innerHTML = 
    `Round Points:&nbsp;<b>${getPointsPossibleForSong(true)}/${getPointsPossibleForSong(false)}</b>`;
  (document.getElementById('hint-btn') as HTMLElement).classList.remove('disabled');
  (document.getElementById('advance-cont') as HTMLElement).style.display = 'none';
  (document.getElementById('song-guess-dom') as HTMLInputElement).value = '';
  const progressDOM: HTMLElement = document.getElementById('progress-arc') as HTMLElement;
  progressDOM.setAttribute('d','M 758.6255110086881 144.03252247502314 A 440 440 0 0 0 500 60');
  //@ts-ignore
  progressDOM.stroke = 'var(--green)';
}

function playPauseSong(): void {
  const audioDOM: HTMLAudioElement = document.getElementById('audio-dom') as HTMLAudioElement;
  const playPauseDOM: HTMLElement = document.getElementById('play-pause-icon') as HTMLElement;
  const playbackDOM: HTMLElement = document.getElementById('playback-counter') as HTMLElement;
  if (isSongPlaying === true) {
    clearInterval(songDurationInterval);
    audioDOM.pause();
    isSongPlaying = false;
    playPauseDOM.setAttribute('d','M8,5.14V19.14L19,12.14L8,5.14Z');
    audioDOM.currentTime = 0;
    return;
  }
  const durationInSeconds: number = [2,5,9,14,20][hintsUsed];
  isSongPlaying = true;
  audioDOM.currentTime = 0;
  audioDOM.play();
  playPauseDOM.setAttribute('d','M14,19H18V5H14M6,19H10V5H6V19Z');
  songDurationInterval = window.setInterval(() => {
    const angle: number = progressToRadians(audioDOM.currentTime / 20);
    playbackDOM.setAttribute('x1',String(470 * Math.cos(angle) + 500));
    playbackDOM.setAttribute('y1',String(-470 * Math.sin(angle) + 500));
    playbackDOM.setAttribute('x2',String(410 * Math.cos(angle) + 500));
    playbackDOM.setAttribute('y2',String(-410 * Math.sin(angle) + 500));
    if (audioDOM.currentTime >= durationInSeconds - 0.01) {
      playPauseDOM.setAttribute('d','M8,5.14V19.14L19,12.14L8,5.14Z');
      audioDOM.pause();
      isSongPlaying = false;
      clearInterval(songDurationInterval);
    }
  },15);
}

function useHint(): void {
  if (hintsUsed >= 4) {
    return;
  }
  const oldDurationInSeconds: number = [2,5,9,14,20][hintsUsed];
  const oldColor: HSL = colorDict[['green','yellow-green','yellow','orange','red'][hintsUsed]];
  hintsUsed++;
  const newDurationInSeconds: number = [2,5,9,14,20][hintsUsed];
  const newColor: HSL = colorDict[['green','yellow-green','yellow','orange','red'][hintsUsed]];

  (document.getElementById('round-dom') as HTMLElement).innerHTML = 
    `Round Points:&nbsp;<b>${getPointsPossibleForSong(true)}/${getPointsPossibleForSong(false)}</b>`;
  if (hintsUsed == 4) {
    (document.getElementById('hint-btn') as HTMLElement).classList.add('disabled');
  }
  (document.getElementById('hint-btn') as HTMLElement).blur();

  const progressDOM: HTMLElement = document.getElementById('progress-arc') as HTMLElement;
  let iter: number = 0;
  const endIter: number = 15;
  const interval: number = window.setInterval(() => {
    iter++;
    const iterDuration = (newDurationInSeconds - oldDurationInSeconds) * iter / endIter + oldDurationInSeconds;
    const endAngle: number = iterDuration*18==360?359.9:iterDuration*18;
    progressDOM.setAttribute('d',getArcPath(500,500,440,0,endAngle));
    const iterHue: number = (newColor.h - oldColor.h) * iter / endIter + oldColor.h;
    const iterSat: number = (newColor.s - oldColor.s) * iter / endIter + oldColor.s;
    const iterLum: number = (newColor.l - oldColor.l) * iter / endIter + oldColor.l;
    progressDOM.style.stroke = `hsl(${iterHue},${iterSat}%,${iterLum}%)`;

    if (iter == endIter) {
      clearInterval(interval);
    }
  },20);
}

function getPointsPossibleForSong(accountForHints: boolean): number {
  if (accountForHints == true) {
    return songList[songIndex].difficulty * 80 * (1/2)**hintsUsed;
  }
  return songList[songIndex].difficulty * 80;
}

//guess management

function buildSongList(): void {
  const parentDOM: HTMLElement = document.getElementById('song-list-cont') as HTMLElement;
  for (const child of parentDOM.children) {
    if (child.id != 'no-matching-dom') {
      child.remove();
    }
  }
  const iconDOM: SVGElement = document.createElementNS('http://www.w3.org/2000/svg','svg');
  iconDOM.setAttribute('viewBox','0 0 24 24');
  const pathDOM: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg','path');
  pathDOM.setAttribute('d','M16,9H13V14.5A2.5,2.5 0 0,1 10.5,17A2.5,2.5 0 0,1 8,14.5A2.5,2.5 0 0,1 10.5,12C11.07,12 11.58,12.19 12,12.5V7H16V9M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z');
  iconDOM.appendChild(pathDOM);
  const alphabeticSongList: Song[] = songList.slice().sort(function(a: Song,b: Song): number {
    return (a.title > b.title)?1:-1;
  });
  for (const song of alphabeticSongList) {
    const rowDOM: HTMLElement = document.createElement('DIV');
    rowDOM.classList.add('song-row');
    rowDOM.id = 'song-row-' + String(song.id);
    rowDOM.appendChild(iconDOM.cloneNode(true));
    parentDOM.appendChild(rowDOM);
    const titleDOM: HTMLElement = document.createElement('DIV');
    titleDOM.textContent = song.title;
    rowDOM.appendChild(titleDOM);
    rowDOM.onclick = makeGuess;
  }
}

function searchSongs(search: string): void {
  const songSearchList = fuzzysort.go(search,songList,{key:'title'});
  const songListDOM: HTMLElement = document.getElementById('song-list-cont') as HTMLElement;
  const noMatchDOM: HTMLElement = document.getElementById('no-matching-dom') as HTMLElement;
  for (const songRowDOM of songListDOM.children) {
    (songRowDOM as HTMLElement).style.display = search.length==0?'grid':'none';
  }
  if (search.length == 0) {
    noMatchDOM.style.display = 'none';
  } else if (songSearchList.length == 0) {
    noMatchDOM.style.display = 'grid';
  } else {
    for (let i = songSearchList.length - 1; i >= 0; i--) {
      const song: Song = getSongFromTitle(songSearchList[i].target);
      //@ts-ignore
      const highlighted: string = fuzzysort.highlight(fuzzysort.single(search,song.title),
        '<span style="background-color:var(--quadruple-accent)">','</span>');
      const songRowDOM: HTMLElement = (document.getElementById('song-row-' + String(song.id)) as HTMLElement);
      songRowDOM.style.display = 'grid';
      songRowDOM.children[1].innerHTML = highlighted;
      songListDOM.insertBefore(songRowDOM,noMatchDOM.nextElementSibling);
    }
  }
}

function makeGuess(ev: MouseEvent): void {
  let iterDOM: HTMLElement | null = ev.target as HTMLElement;
  let songId: number | null = null;
  while (iterDOM != null) {
    if (iterDOM.id.indexOf('song-row-') != -1) {
      songId = Number(iterDOM.id.replace('song-row-',''));
      break;
    }
    iterDOM = iterDOM.parentElement;
  }
  if (songId == null) {
    throw 'WTF';
  }
  const correctSong: Song = songList[songIndex];
  (document.getElementById('advance-cont') as HTMLElement).style.display = 'block';
  const feedbackDOM: HTMLElement = document.getElementById('feedback') as HTMLElement;
  const titleDOM: HTMLElement = document.getElementById('feedback-song-title') as HTMLElement;
  titleDOM.style.fontSize = String(getSafeSongTitleFontSize(correctSong.title)) + 'px';
  titleDOM.textContent = correctSong.title;
  totalPointsPossible += getPointsPossibleForSong(false);

  const audioDOM: HTMLAudioElement = document.getElementById('audio-dom') as HTMLAudioElement;
  audioDOM.pause();
  audioDOM.currentTime = correctSong.chorus;
  const startFadeIter: number = 80;
  const endFadeIter: number = 200;
  function logistic(x: number): number {
    const k: number = 0.05;
    return 1 / (1 + Math.E ** (k * ((x - endFadeIter / 2))));
  } 
  let iter: number = 0;
  audioDOM.play();
  volumeFadeInterval = window.setInterval(() => {
    iter++;
    if (iter >= startFadeIter) {
      audioDOM.volume = logistic(iter);
    }
    if (iter == endFadeIter) {
      audioDOM.pause();
      clearInterval(volumeFadeInterval);
    }
  },20);

  if (songId == correctSong.id) {
    totalPointsEarned += getPointsPossibleForSong(true);
    feedbackDOM.classList.add('correct');
    feedbackDOM.classList.remove('incorrect');
    feedbackDOM.textContent = 'Correct!';
  } else {
    feedbackDOM.classList.add('incorrect');
    feedbackDOM.classList.remove('correct');
    feedbackDOM.textContent = 'Uh-oh!';
  }
}

//resources

function getSafeSongTitleFontSize(title: string): number {
  const words: string[] = title.split(' ');
  let lengthOfLongestWord: number = 0;
  for (const word of words) {
    if (word.length > lengthOfLongestWord) {
      lengthOfLongestWord = word.length;
    }
  }
  // const titleLengthFontSize: number = Math.round(title.length * 0.9994 - 0.9997);
  // const longestWordFontSize: number = Math.round(lengthOfLongestWord * -3.1 + 56.9);
  const titleLengthFontSize: number = Math.round(48 - 0.5 * title.length);
  const longestWordFontSize: number = Math.round(55 - 1.4 * lengthOfLongestWord);
  if (lengthOfLongestWord >= 12) {
    return 24;
  }
  if (titleLengthFontSize < 12 && longestWordFontSize < 12) {
    return 12;
  }
  return Math.min(titleLengthFontSize,longestWordFontSize);
}

// function progressToDegrees(progress: number): number {
//   return ((-2 * ((progress==0)?1:progress) + 2.5) % 2) * 180;
// }

function progressToRadians(progress: number): number {
  return (-2 * Math.PI * ((progress==0)?1:progress) + 2.5 * Math.PI) % (Math.PI * 2);
}

function getArcPath(cx: number,cy: number,radius: number,startAngleInDegrees: number,endAngleInDegrees: number): string {
  function polarToCartesian(centerX: number,centerY: number,radius: number,angleInDegrees: number): {x: number,y: number} {
    const angleInRadians: number = (angleInDegrees - 90) * Math.PI / 180;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }
  const start: {x: number,y: number} = polarToCartesian(cx,cy,radius,endAngleInDegrees);
  const end: {x: number,y: number} = polarToCartesian(cx,cy,radius,startAngleInDegrees);
  const largeArcFlag: string = (endAngleInDegrees-startAngleInDegrees<=180)?'0':'1';
  return [
    'M', start.x, start.y, 
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(' ');
}

function shuffleArray(array: any[]): any[] {
  for (var i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));      
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

//song data

//1 super easy (immediate chorus,w/in 5 sec)
//2 quick chorus or name (w/in 10 sec)
//3 later chorus/well-known (w/in 20 sec)
//4 obsure
//5 super obsure

function getSongFromTitle(title: string): Song {
  for (const song of songList) {
    if (song.title == title) {
      return song;
    }
  }
  throw new Error(`Song not found: "${title}"`);
}

const songList: Song[] = [
  {id:1,title:'Ain\'t Got Rhythm',chorus:38,difficulty:2,url:'http://archive.org/download/phineasandferb_202110/Ain\'t Got Rhythm.mp3'},
  {id:2,title:'Backyard Beach',chorus:8,difficulty:2,url:'http://archive.org/download/phineasandferb_202110/Backyard Beach.mp3'},
  {id:3,title:'Busted',chorus:31,difficulty:3,url:'http://archive.org/download/phineasandferb_202110/Busted.mp3'},
  {id:4,title:'Chains On Me',chorus:24,difficulty:4,url:'http://archive.org/download/phineasandferb_202110/Chains On Me.mp3'},
  {id:5,title:'Disco Miniature Golfing Queen',chorus:36,difficulty:5,url:'http://archive.org/download/phineasandferb_202110/Disco Miniature Golfing Queen.mp3'},
  {id:6,title:'Do Nothing Day',chorus:39,difficulty:5,url:'http://archive.org/download/phineasandferb_202110/Do Nothing Day.mp3'},
  {id:7,title:'E.V.I.L B.O.Y.S',chorus:27,difficulty:3,url:'http://archive.org/download/phineasandferb_202110/E.V.I.L B.O.Y.S.mp3'},
  {id:8,title:'F-Games',chorus:50,difficulty:5,url:'http://archive.org/download/phineasandferb_202110/F-Games.mp3'},
  {id:9,title:'Fabulous',chorus:37,difficulty:2,url:'http://archive.org/download/phineasandferb_202110/Fabulous.mp3'},
  {id:10,title:'Gitchee Gitchee Goo',chorus:21,difficulty:1,url:'http://archive.org/download/phineasandferb_202110/Gitchee Gitchee Goo.mp3'},
  {id:11,title:'He\'s a Bully',chorus:30,difficulty:4,url:'http://archive.org/download/phineasandferb_202110/He\'s A Bully.mp3'},
  {id:12,title:'I Love You Mom',chorus:52,difficulty:1,url:'http://archive.org/download/phineasandferb_202110/I Love You Mom.mp3'},
  {id:13,title:'I\'m Lindana And I Wanna Have Fun',chorus:15,difficulty:3,url:'http://archive.org/download/phineasandferb_202110/I_m Lindana And I Wanna Have Fun.mp3'},
  {id:14,title:'Let\'s Take A Rocket Ship To Outer Space',chorus:0,difficulty:1,url:'http://archive.org/download/phineasandferb_202110/Let\'s Take A Rocket Ship To Outer Space.mp3'},
  {id:15,title:'Little Brothers',chorus:57,difficulty:2,url:'http://archive.org/download/phineasandferb_202110/Little Brothers.mp3'},
  {id:16,title:'My Goody Two-Shoes Brother',chorus:45,difficulty:5,url:'http://archive.org/download/phineasandferb_202110/My Goody Two-Shoes Brother.mp3'},
  {id:17,title:'My Nemesis',chorus:23,difficulty:2,url:'http://archive.org/download/phineasandferb_202110/My Nemesis.mp3'},
  {id:18,title:'My Undead Mummy And Me',chorus:12,difficulty:3,url:'http://archive.org/download/phineasandferb_202110/My Undead Mummy And Me.mp3'},
  // {id:-1,title:'Perry The Platypus Theme',chorus:0,difficulty:-1,url:'http://archive.org/download/phineasandferb_202110/Perry The Platypus Theme.mp3'},
  {id:19,title:'Phinedroid and Ferbots',chorus:0,difficulty:1,url:'http://archive.org/download/phineasandferb_202110/Phinedroids And Ferbots.mp3'},
  {id:20,title:'Queen Of Mars',chorus:19,difficulty:3,url:'http://archive.org/download/phineasandferb_202110/Queen Of Mars.mp3'},
  {id:21,title:'Ready For The Bettys',chorus:33,difficulty:2,url:'http://archive.org/download/phineasandferb_202110/Ready For The Bettys.mp3'},
  {id:22,title:'S.I.M.P (Squirrels In My Pants)',chorus:25,difficulty:1,url:'http://archive.org/download/phineasandferb_202110/S.I.M.P (Squirrels In My Pants).mp3'},
  {id:23,title:'Today Is Gonna Be A Great Day',chorus:106,difficulty:1,url:'http://archive.org/download/phineasandferb_202110/Today Is Gonna Be A Great Day.mp3'},
  {id:24,title:'Truck Drivin\' Girl',chorus:7,difficulty:2,url:'http://archive.org/download/phineasandferb_202110/Truck Drivin_ Girl.mp3'},
  {id:25,title:'When We Didn\'t Get Along',chorus:52,difficulty:4,url:'http://archive.org/download/phineasandferb_202110/When We Didn_t Get Along.mp3'},
  {id:26,title:'You Snuck Your Way Right Into My Heart',chorus:46,difficulty:4,url:'http://archive.org/download/phineasandferb_202110/You Snuck Your Way Right Into My Heart.mp3'},
  {id:27,title:'Back In Gimmelshtump',chorus:14,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Back In Gimmelshtump.mp3'},
  {id:28,title:'Brand New Best Friend',chorus:43,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Brand New Best Friend.mp3'},
  {id:29,title:'Brand New Reality',chorus:28,difficulty:4,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Brand New Reality.mp3'},
  {id:30,title:'Carpe Diem',chorus:52,difficulty:5,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Carpe Diem.mp3'},
  {id:31,title:'Come Home Perry',chorus:43,difficulty:2,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Come Home Perry.mp3'},
  {id:32,title:'Everything\'s Better With Perry',chorus:140,difficulty:4,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Everything_s Better With Perry.mp3'},
  {id:33,title:'Hey Ferb',chorus:41,difficulty:4,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Hey Ferb.mp3'},
  {id:34,title:'Kick It Up A Notch',chorus:56,difficulty:5,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Kick It Up A Notch (Feat. Slash).mp3'},
  {id:35,title:'My Ride From Outer Space',chorus:32,difficulty:4,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/My Ride From Outer Space.mp3'},
  {id:36,title:'Mysterious Force',chorus:66,difficulty:5,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Mysterious Force.mp3'},
  {id:37,title:'Not Knowing Where You\'re Going',chorus:48,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Not Knowing Where You_re Going.mp3'},
  {id:38,title:'Perfect Day',chorus:7,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Perfect Day.mp3'},
  {id:39,title:'Perry the Platypus Theme',chorus:41,difficulty:1,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Perry The Platypus (Extended Version).mp3'},
  {id:40,title:'Robot Riot',chorus:48,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Robot Riot_.mp3'},
  {id:41,title:'Rollercoaster',chorus:8,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Rollercoaster.mp3'},
  {id:42,title:'Summer (Where Do We Begin)',chorus:56,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Summer (Where Do We Begin)_.mp3'},
  {id:43,title:'Takin\' Care Of Things',chorus:15,difficulty:2,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Takin_ Care Of Things.mp3'},
  {id:44,title:'There\'s A Platypus Controlling Us',chorus:63,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/There_s A Platypus Controlling Me.mp3'},
  {id:45,title:'Watcha Doin\'',chorus:13,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/Whatcha Doin_.mp3'},
  {id:46,title:'When You Levitate',chorus:34,difficulty:4,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/When You Levitate.mp3'},
  {id:47,title:'You\'re Going Down',chorus:2,difficulty:1,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/You_re Going Down.mp3'},
  {id:48,title:'You\'re Not Ferb',chorus:12,difficulty:3,url:'http://archive.org/download/PhineasAndFerbAcrossThe2ndDimension/You_re Not Ferb.mp3'},
  {id:49,title:'Summer Belongs to You',chorus:75,difficulty:3,url:'http://archive.org/download/tvtunes_17605/Phineas and Ferb - Summer Belongs to You.mp3'},
  {id:50,title:'When Tomorrow Is This Morning Again',chorus:74,difficulty:3,url:'http://archive.org/download/tvtunes_30778/Phineas and Ferb - Last Day Of Summer - Tomorrow Is This Morning Again.mp3'},
];