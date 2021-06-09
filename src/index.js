var canvas = document.getElementById("renderCanvas"); // Get the canvas element
//focus canvas so we get keyboard events, otherwise need to click on it first
canvas.focus();
var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
var scene;

import("./lib/avatar-selection.js").then( (module) =>{

  document.getElementById('nickname').addEventListener('input', (e)=>{
    world.setName(e.target.value);
  });
  document.getElementById('nickname').addEventListener('change', (e)=>{
    canvas.focus();
  });

  document.getElementById('chatBox').style.display = 'none';
  document.getElementById('chatInput').addEventListener('change', (e)=>{
    world.worldManager.sendMy({wrote:e.target.value});
    chatLog("ME", e.target.value);
    e.target.value = '';
    //canvas.focus();
  });

  document.getElementById('chatInput').addEventListener('focus', (e)=>{
    document.getElementById('chatLog').style.display = 'block';
    var div = document.getElementById('chatLog');
    clearChatLog(div.children[div.children.length-1]);
  });
  document.getElementById('chatInput').addEventListener('blur', (e)=>{
    setTimeout(() => document.getElementById('chatLog').style.display = 'none', 200);
  });

  var world = module.WORLD;
  world.VRSPACEUI.contentBase='https://www.vrspace.org/';

  world.init(engine, 'avatar').then((s) => {
    scene = s;
    world.createSelection();
    world.showPortals();
    engine.resize();
    canvas.focus();
    world.beforeEnter = () => {
      document.getElementById('loginForm').style.display = 'none';
    }
    world.afterEnter = () => {
      document.getElementById('chatBox').style.display = 'block';
      world.worldManager.changeListeners.push((obj, field, node) => remoteEvent(obj,field,node));
    }
    world.afterExit = () => {
      console.log('Exit:'+world.worldManager.error);
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('chatBox').style.display = 'none';
      document.getElementById('chatLog').style.display = 'block';
      chatLog('ERROR', world.worldManager.error);
    }
  });

  var xmlHttp = new XMLHttpRequest();
  xmlHttp.responseType = "text";
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
      var info = JSON.parse(xmlHttp.responseText);
      // some useful stats
      // info.git.build.version
      // info.git.build.time
      // info.git.commit.id.abbrev
      // info.git.commit.message.short
      // info.git.total.commit.count
      var text = info.git.build.version+' '+info.git.build.time+' '+info.git.commit.id.abbrev+' '+info.git.commit.message.short;
      document.getElementById("version").innerHTML = 'v'+text;
    }
  }
  var serverUrl = process.env.VRSPACE_SERVER_URL ? process.env.VRSPACE_SERVER_URL : 'https://www.vrspace.org';
  xmlHttp.open("GET", `${serverUrl}/actuator/info`, true); // true for asynchronous
  xmlHttp.send(null);

})

//Watch for browser/canvas resize events
var resizing = false;
var tmp = window.devicePixelRatio;
window.addEventListener("resize", () => {
  if ( ! resizing ) {
    // resize engine after browser has resized
    setTimeout( () => {
      resizing = true;
      engine.resize();
      // fire the event again to move Enter VR button to proper place
      // (seems it calculates position immediately)
      window.dispatchEvent(new Event('resize'));
      resizing = false;
    }, 200); // CHECKME 100ms enough?
  }
});


function remoteEvent(obj, field, node) {
  if ( 'wrote' === field ) {
    console.log(obj.id+' wrote '+obj.wrote);
    var name = obj.name;
    if ( ! name ) {
      name = 'u'+obj.id;
    }
    chatLog(name, obj.wrote);
  }
}

function chatLog( who, what ) {
  var div = document.createElement("div");
  if ( hasLink(what) ) {
    // process hyperlinks
    let string = '';
    what.split(' ').forEach((word)=>{
      if ( hasLink(word) ) {
        word = makeLink(word);
      }
      string += word + ' ';
    });
    what = string;
  }
  var text = "["+who+"] "+what;
  div.innerHTML = text;
  div.style="color: white;";
  document.getElementById('chatLog').appendChild(div);
  clearChatLog(div);
}

function hasLink(what) {
  return what.indexOf("://") > -1 || what.indexOf('www.') > -1 ;
}
function makeLink(word) {
  var link = word;
  if ( link.indexOf("://") == -1) {
    link = "https://"+link;
  }
  return '<a target="_blank" href="'+link+'">'+word+'</a> ';
}

function clearChatLog( div ) {
  var log = document.getElementById('chatLog');
  while ( div.getBoundingClientRect().bottom > log.getBoundingClientRect().bottom) {
    log.removeChild(log.children[1]);
  }
}

//prevent arrow keys and space from scroling the page
//only if webgl canvas is focused
window.addEventListener("keydown", function(e) {
  if( document.activeElement === canvas && [32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
    e.preventDefault();
  }
}, false);

function debugOnOff() {
  console.log("Debug: "+scene.debugLayer.isVisible());
  if ( scene.debugLayer.isVisible() ) {
    scene.debugLayer.hide();
  } else {
    scene.debugLayer.show();
  }
}