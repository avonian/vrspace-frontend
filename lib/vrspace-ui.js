import {VRSPACE} from './vrspace.js';
import {Avatar} from './avatar.js';

export class VRSpaceUI {

  constructor( ) {
    this.scene = null;
    this.logo = null;
    this.portal = null;
    this.initialized = false;
    this.debug = false;
    this.fps = 5; // CHECKME: reasonable default fps
    this.loadProgressIndicator = (scene, camera) => this.loadProgressIndicatorFactory(scene, camera);
    this.indicator = null;
  }

  async init(scene) {
    if ( ! this.initialized || this.scene !== scene ) {
      this.scene = scene;
      // TODO figure out location of script
      var container = await BABYLON.SceneLoader.LoadAssetContainerAsync("/babylon/","logo.glb",this.scene);
      this.logo = container.meshes[0];
      for ( var i = 0; i < container.meshes; i++ ) {
        container.meshes[i].checkCollisions = false;
      }
      this.logo.name = "VRSpace.org Logo";
      await this.loadPortal(scene);
      this.initialized = true;
    }
    return this;
  }

  loadProgressIndicatorFactory(scene, camera) {
    if ( ! this.indicator ) {
      this.indicator = new LoadProgressIndicator(scene, camera);
    }
    return this.indicator;
  }
  
  log( something ) {
    if ( this.debug ) {
      console.log( something );
    }
  }

  async loadPortal(scene) {
    if ( ! this.portal ) {
      var container = await BABYLON.SceneLoader.LoadAssetContainerAsync("/babylon/portal/", "scene.gltf", scene)
      container.materials[0].albedoColor = BABYLON.Color3.FromHexString('#B3EEF3');
      container.materials[0].metallic = 0.85;
      
      this.portal = container.createRootMesh();
      this.portal.rotation = new BABYLON.Vector3(0,Math.PI/2,0);
      this.portal.name = 'Portal';
      //container.addAllToScene();
    }
    return this.portal;
  }

  // lists files on a server directory
  listFiles(theUrl, callback){
    this.log("Fetching "+theUrl);
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.responseType = "document";
    xmlHttp.onreadystatechange = function() {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
        callback(xmlHttp);
      }
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
    return xmlHttp;
  }
  
  // list folders with their jpg thumbnails
  listThumbnails(dir, callback) {
    this.listMatchingFiles( dir, callback, '.jpg' )
  }

  // list character folders and their fix files
  listCharacters(dir, callback) {
    this.listMatchingFiles( dir, callback, '-fixes.json' )
  }
  
  // list server folders along with their matching files
  // i.e. files with the same name, plus given suffix
  listMatchingFiles(dir, callback, suffix) {
    if ( !dir.endsWith('/') ) {
      dir += '/';
    }
    var ui = this;
    return this.listFiles(dir, (xmlHttp) => {
      var links = xmlHttp.responseXML.links;
      var files = [];
      var fixes = [];
      
      // first pass:
      // iterate all links, collect avatar directories and fixes
      for ( var i = 0; i < links.length; i++ ) {
        var link = links[i];
        var href = link.href;
        if ( href.indexOf('?') > 0 ) {
          continue;
        }
        if ( link.baseURI.length > link.href.length ) {
          continue;
        }
        if ( link.href.endsWith(suffix) ) {
          fixes.push(href.substring(link.baseURI.length));
          continue;
        }
        if ( ! link.href.endsWith('/') ) {
          continue;
        }
        href = href.substring(link.baseURI.length);
        href = href.substring(0,href.indexOf('/'));
        ui.log(link.baseURI+' '+href);
        files.push(href);
      }

      // second pass: match folders with related files
      var folders = [];
      for ( var i = 0; i < files.length; i++ ) {
        var fix = null;
        var fixName = files[i]+suffix;
        var index = fixes.indexOf(fixName);
        if ( index >= 0) {
          fix = fixes[index];
        }
        folders.push(new ServerFolder( dir, files[i], fix ));
      }
      
      ui.log(folders);
      callback(folders);
    });
  }
  
  // utility methods to manipulate meshes
  receiveShadows( node, shadows ) {
    node.receiveShadows = shadows;
    if ( node.material ) {
      if ( node.material.getClassName() == "PBRMaterial" ) {
        // something to do with inverse square root of physical material
        node.material.usePhysicalLightFalloff = false;
      }
    }
    var children = node.getChildren();
    for ( var i = 0; i < children.length; i++ ) {
      this.receiveShadows(children[i], shadows);
    }
  }

  // utility method - instantiate/clone mesh
  copyMesh(mesh, parent, replaceParent) {
    if ( mesh.geometry ) {
      var copy = mesh.createInstance(mesh.name+"-copy");
      copy.parent = parent;
    } else if (replaceParent && parent) {
      copy = parent;
    } else {
      var copy = mesh.clone( mesh.name+"-copy", parent, true, false );
      copy.parent = parent;
    }
    var children = mesh.getChildren();
    for ( var i = 0; i < children.length; i++ ) {
      this.copyMesh(children[i], copy, replaceParent);
    }
    return copy;
  }

  // utility method - create x,y,z animation of a mesh field  
  createAnimation(mesh, field, fps) {
    if ( ! fps ) {
      fps = this.fps;
    }
    var group = new BABYLON.AnimationGroup(field+" "+mesh.id);
    
    var xAnim = new BABYLON.Animation("xAnim "+mesh.id, field+".x", fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var xKeys = []; 
    xKeys.push({frame:0, value: 0});
    xKeys.push({frame:1, value: 0});
    xAnim.setKeys(xKeys);
    
    var yAnim = new BABYLON.Animation("yAnim "+mesh.id, field+".y", fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var yKeys = []; 
    yKeys.push({frame:0, value: 0});
    yKeys.push({frame:1, value: 0});
    yAnim.setKeys(yKeys);

    var zAnim = new BABYLON.Animation("zAnim "+mesh.id, field+".z", fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var zKeys = []; 
    zKeys.push({frame:0, value: 0});
    zKeys.push({frame:1, value: 0});
    zAnim.setKeys(zKeys);

    group.addTargetedAnimation(xAnim, mesh);
    group.addTargetedAnimation(yAnim, mesh);
    group.addTargetedAnimation(zAnim, mesh);

    return group;
  }
  
  // utility method - update x,y,z animation of a mesh field  
  updateAnimation(group, from, to) {
    if ( group.isPlaying ) {
      group.stop();
    }
    var xAnim = group.targetedAnimations[0].animation;
    xAnim.getKeys()[0].value = from.x;
    xAnim.getKeys()[1].value = to.x;
    var yAnim = group.targetedAnimations[1].animation;
    yAnim.getKeys()[0].value = from.y;
    yAnim.getKeys()[1].value = to.y;
    var zAnim = group.targetedAnimations[2].animation;
    zAnim.getKeys()[0].value = from.z;
    zAnim.getKeys()[1].value = to.z;
    group.play(false);
  }
 
  // utility method - create quaternion animation of a mesh field  
  createQuaternionAnimation(mesh, field, fps) {
    if ( ! fps ) {
      fps = this.fps;
    }
    var group = new BABYLON.AnimationGroup(field+" "+mesh.id);
    
    var anim = new BABYLON.Animation("qAnim "+mesh.id, field, fps, BABYLON.Animation.ANIMATIONTYPE_QUATERNION, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var keys = []; 
    keys.push({frame:0, value: 0});
    keys.push({frame:1, value: 0});
    anim.setKeys(keys);
    
    group.addTargetedAnimation(anim, mesh);

    return group;
  }
  
  // utility method - update quaternion animation of a mesh field  
  updateQuaternionAnimation(group, from, to) {
    if ( group.isPlaying ) {
      group.stop();
    }
    // 'to' is a Vector3, 'from' is current rotationQuaternion
    // we have to rotate around to.y axis
    var dest = new BABYLON.Quaternion.FromEulerAngles(0,to.y,0);
    var anim = group.targetedAnimations[0].animation;
    anim.getKeys()[0].value = from;
    anim.getKeys()[1].value = dest;
    group.play(false);
  }
  

}

export const VRSPACEUI = new VRSpaceUI();

// room with logo as floor and invisible walls
export class LogoRoom {
  constructor( scene ) {
    this.scene = scene;
    this.diameter = 20;
    this.shadows = true;
  }
  async load() {
    this.floorGroup = new BABYLON.TransformNode("Floor");
    // ground, used for teleportation/pointer
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", {}, scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, 0.1, 0 );
    this.ground.parent = this.floorGroup;
    this.ground.isVisible = false;
    this.ground.checkCollisions = true;

    // mesh that we display as floor
    await VRSPACEUI.init(scene); // wait for logo to load
    VRSPACEUI.receiveShadows( VRSPACEUI.logo, this.shadows );
    VRSPACEUI.copyMesh(VRSPACEUI.logo, this.floorGroup, true);

    // walls, used for collisions, to limit the movement
    var walls = BABYLON.MeshBuilder.CreateCylinder("FloorWalls", {height:4,diameter:1,sideOrientation:BABYLON.Mesh.BACKSIDE}, scene);
    walls.checkCollisions = true;
    walls.isVisible = false;
    walls.position = new BABYLON.Vector3(0,2,0);
    walls.parent = this.floorGroup;

    this.setDiameter(this.diameter);
    this.floorGroup.position = new BABYLON.Vector3( 0, -0.05, 0 );
    this.scene.addTransformNode(this.floorGroup);
    
    return this;
  }
  dispose() {
    this.floorGroup.dispose();
  }
  setDiameter( diameter ) {
    this.diameter = diameter;
    this.floorGroup.scaling = new BABYLON.Vector3(this.diameter,2,this.diameter);
  }
  getDiameter() {
    return this.diameter;
  }
}

export class Portal {
  constructor( scene, serverFolder, callback, shadowGenerator ) {
    this.scene = scene;
    this.serverFolder = serverFolder;
    this.callback = callback;
    this.name = serverFolder.name;
    if ( serverFolder.relatedUrl() ) {
      this.thumbnail = new BABYLON.Texture(serverFolder.relatedUrl());
    }
    this.shadowGenerator = shadowGenerator;
    this.isEnabled = false;
    // used in dispose:
    this.controls = [];
    this.textures = [];
    this.materials = [];
  }
  worldUrl() {
    return this.serverFolder.baseUrl+this.serverFolder.name;
  }
  dispose() {
    this.group.dispose();
    if (this.thumbnail) {
      this.thumbnail.dispose();
    }
    this.material.dispose();
    for ( var i = 0; i < this.controls.length; i++ ) {
      // CHECKME doesn's seem required
      this.controls[i].dispose();
    }
    for ( var i = 0; i < this.textures.length; i++ ) {
      this.textures[i].dispose();
    }
    for ( var i = 0; i < this.materials.length; i++ ) {
      this.materials[i].dispose();
    }
  }
  async loadAt(x,y,z,angle) {
    this.group = new BABYLON.TransformNode('Portal:'+this.name);
    this.group.position = new BABYLON.Vector3(x,y,z);
    this.group.rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,angle);

    if (this.shadowGenerator) {
      var clone = VRSPACEUI.portal.clone();
      clone.parent = this.group;
      var meshes = clone.getChildMeshes();
      for ( var i = 0; i < meshes.length; i++ ) {
        this.shadowGenerator.getShadowMap().renderList.push(meshes[i]);
      }
    } else {
      VRSPACEUI.copyMesh(VRSPACEUI.portal, this.group);
    }

    var plane = BABYLON.Mesh.CreatePlane("PortalEntrance:"+this.name, 1.60, scene);
    plane.parent = this.group;
    plane.position = new BABYLON.Vector3(0,1.32,0);
    var observable = (e) => {
      if(e.type == BABYLON.PointerEventTypes.POINTERDOWN){
        var p = e.pickInfo;
        if ( p.pickedMesh == plane ) {
          if ( this.isEnabled ) {
            console.log("Entering "+this.name);
            this.scene.onPointerObservable.clear();
            this.enter();
          } else {
            console.log("Not entering "+this.name+" - disabled");
          }
        }
      }
    };
    this.scene.onPointerObservable.add(observable);

    this.material = new BABYLON.StandardMaterial(this.name+"-noise", scene);
    plane.material = this.material;

    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    var noiseTexture = new BABYLON.NoiseProceduralTexture(this.name+"-perlin", 256, scene);
    this.material.lightmapTexture = noiseTexture;
    noiseTexture.octaves = 4;
    noiseTexture.persistence = 1.2;
    noiseTexture.animationSpeedFactor = 2;
    plane.visibility = 0.85;
    this.textures.push( noiseTexture );

    this.title = BABYLON.MeshBuilder.CreatePlane("Text:"+this.name, {height:1,width:2}, scene);
    this.title.parent = this.group;
    this.title.position = new BABYLON.Vector3(0,2.5,0);
    this.title.isVisible = false;

    var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.title, 128,128);
    this.materials.push(this.title.material);
    
    var titleText = new BABYLON.GUI.TextBlock();
    titleText.text = this.name;
    titleText.color = "white";

    titleTexture.addControl(titleText);
    //this.controls.push(titleText); // CHECKME doesn's seem required
    this.textures.push(titleTexture);
    
    return this;
  }
  enabled(enable) {
    if ( enable ) {
      this.material.emissiveTexture = this.thumbnail;
    } else {
      this.material.emissiveTexture = null;
    }
    this.title.isVisible = enable;
    this.isEnabled = enable;
  }
  enter() {
    if ( this.callback ) {
      this.callback(this);
    }
  }
}

// a folder with a related file
class ServerFolder {
  constructor( baseUrl, name, related ) {
    this.baseUrl = baseUrl;
    this.name = name;
    this.related = related;
  }
  url() {
    return this.baseUrl+this.name;
  }
  relatedUrl() {
    if ( this.related ) {
      return this.baseUrl+this.related;
    }
    return null;
  }
}

export class LoadProgressIndicator {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.mesh = null;
    this.totalItems = 0;
    this.currentItem = 0;
    this.zeroRotation = null;
    this.debug = false;
    this.angle = 0;
    this.trackItems = true;
    var indicator = this;
    VRSPACEUI.init(scene).then( (ui) => {
        indicator.mesh = ui.logo.clone("LoadingProgressIndicator");
        indicator.mesh.scaling.scaleInPlace(0.05);
        indicator.attachTo( indicator.camera );
        indicator.zeroRotation = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X,Math.PI/2);
        indicator.mesh.rotationQuaternion = indicator.zeroRotation;
        indicator.mesh.setEnabled(indicator.totalItems > indicator.currentItem);
        indicator.log("Loaded logo, current progress "+indicator.currentItem+"/"+indicator.totalItems);
    });
    scene.onActiveCameraChanged.add( () => {
      if ( scene.activeCamera ) {
        console.log("Camera changed: "+scene.activeCamera.getClassName());
        this.attachTo(camera); // FIXME undefined
      }
    });
  }
  _init() {
    this.totalItems = 0;
    this.currentItem = 0;
    this.angle = 0;
  }
  attachTo(camera) { // FIXME not used
    this.camera = this.scene.activeCamera;
    if ( this.mesh ) {
      this.mesh.parent = this.scene.activeCamera;
      // VRDeviceOrientationFreeCamera
      // WebXRCamera
      if ( this.scene.activeCamera.getClassName() == 'WebXRCamera' ) {
        this.mesh.position = new BABYLON.Vector3(0,-0.2,0.5);
      } else {
        this.mesh.position = new BABYLON.Vector3(0,-0.1,0.5);
      }
    }
  }
  add(item) {
    if ( this.mesh && ! this.mesh.isEnabled() ) {
      this.mesh.setEnabled(true);
    }
    this.totalItems++;
    this.log("Added "+this.currentItem+"/"+this.totalItems);
    this._update();
  }
  remove(item) {
    this.currentItem++;
    this._update();
    this.log("Finished "+this.currentItem+"/"+this.totalItems);
    if ( this.totalItems <= this.currentItem && this.mesh ) {
      this.mesh.setEnabled(false);
      if ( this.animation ) {
        scene.unregisterBeforeRender(this.animation);
        delete this.animation;
      }
      this._init();
    }
  }
  animate() {
    this.trackItems = false;
    this.animation = () => { this._update() };
    this.scene.registerBeforeRender( this.animation );
  }
  progress(evt, item) {
    this.trackItems = false;
    if (evt.lengthComputable) {
      var loaded = evt.loaded / evt.total;
      this.log("Loaded "+(loaded*100)+"%");
      if ( this.mesh && this.zeroRotation ) {
        this.angle -= 0.01;
        this.mesh.rotationQuaternion = this.zeroRotation.multiply( new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,this.angle) );
      }
    } else {
      var dlCount = evt.loaded / (1024 * 1024);
      this.log("Loaded "+dlCount+" MB" );
    }
  }
  _update() {
    if ( this.mesh && this.zeroRotation ) {
      if ( this.trackItems ) {
        this.angle = 2*Math.PI*(1-this.currentItem/this.totalItems);
      } else {
        this.angle -= 0.01;
      }
      this.mesh.rotationQuaternion = this.zeroRotation.multiply( new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,this.angle) );
    }
  }
  log(something) {
    if ( this.debug ) {
      console.log(something);
    }
  }
}

export class RecorderUI {
  constructor( scene ) {
    // parameters
    this.scene = scene;
    this.recorder = null;
    // state variables
    scene.onActiveCameraChanged.add( (s) => this.cameraChanged() );
  }
  cameraChanged() {
    console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    this.camera = this.scene.activeCamera;
    this.recordButton.mesh.parent = this.camera;
    this.stopButton.mesh.parent = this.camera;
    this.playButton.mesh.parent = this.camera;
  }
  showUI() {
    this.camera = this.scene.activeCamera;

    var manager = new BABYLON.GUI.GUI3DManager(scene);

    this.recordButton = new BABYLON.GUI.HolographicButton("RecordEvents");
    manager.addControl(this.recordButton);
    this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Dot.png"; // FIXME: cdn
    this.recordButton.text="REC";
    this.recordButton.position = new BABYLON.Vector3(-0.1,-0.1,.5);
    this.recordButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.recordButton.onPointerDownObservable.add( () => this.record());
    this.recordButton.mesh.parent = this.camera;
    
    this.stopButton = new BABYLON.GUI.HolographicButton("StopRecording");
    this.stopButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Pause.png"; // FIXME: cdn
    this.stopButton.text="Stop";
    manager.addControl(this.stopButton);
    this.stopButton.position = new BABYLON.Vector3(0,-0.1,.5);
    this.stopButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.stopButton.onPointerDownObservable.add( () => this.stop());
    this.stopButton.mesh.parent = this.camera;
    this.stopButton.isVisible = false;

    this.playButton = new BABYLON.GUI.HolographicButton("StartPlaying");
    this.playButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Play.png"; // FIXME: cdn
    manager.addControl(this.playButton);
    this.playButton.text="Play";
    this.playButton.position = new BABYLON.Vector3(0.1,-0.1,.5);
    this.playButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.playButton.onPointerDownObservable.add( () => this.play());
    this.playButton.mesh.parent = this.camera;
    this.playButton.isVisible = false;
  }
  
  record() {
    console.log("Recording...");
    if ( ! this.recorder ) {
      // create recorder on the server
      VRSPACE.send('{"command":{"Recording":{"action":"record"}}}');
    }
    this.stopButton.isVisible = true;
    this.playButton.isVisible = false;
  }
  stop() {
    console.log('Stopped');
    VRSPACE.send('{"command":{"Recording":{"action":"stop"}}}');
    this.recordButton.isVisible = true;
    this.playButton.isVisible = true;
    this.stopButton.isVisible = false;
  }
  play() {
    console.log('Playing...');
    VRSPACE.send('{"command":{"Recording":{"action":"play"}}}');
    this.recordButton.isVisible = false;
    this.stopButton.isVisible = true;
  }
  
}

export class FloorRibbon {
  constructor( scene, size ) {
    // parameters
    this.scene = scene;
    if ( size ) {
      this.size = size;
    } else {
      this.size = 1;
    }
    this.decimals = 2;
    this.floorMaterial = new BABYLON.StandardMaterial("floorMaterial", this.scene);
    this.floorMaterial.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    this.floorMaterial.backFaceCulling = false;
    this.floorMaterial.alpha = 0.5;
    // state variables
    this.leftPath = [];
    this.rightPath = [];
    this.pathArray = [this.leftPath, this.rightPath];
    this.left = BABYLON.MeshBuilder.CreateSphere("leftSphere", {diameter: 1}, scene);
    this.right = BABYLON.MeshBuilder.CreateSphere("rightSphere", {diameter: 1}, scene);
    this.left.isVisible = false;
    this.right.isVisible = false;
    scene.onActiveCameraChanged.add( (s) => this.cameraChanged() );
    this.recording = false;
    this.editing = false;
    this.resizing = false;
    this.floorCount = 0;
  }
  cameraChanged() {
    console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    this.camera = this.scene.activeCamera;
    this.left.parent = this.camera;
    this.right.parent = this.camera;
    this.recordButton.mesh.parent = this.camera;
    this.editButton.mesh.parent = this.camera;
    this.jsonButton.mesh.parent = this.camera;
    this.jsButton.mesh.parent = this.camera;
  }
  showUI() {
    this.camera = this.scene.activeCamera;

    var manager = new BABYLON.GUI.GUI3DManager(scene);

    this.recordButton = new BABYLON.GUI.HolographicButton("RecordPath");
    manager.addControl(this.recordButton);
    this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Play.png"; // FIXME: cdn
    this.recordButton.position = new BABYLON.Vector3(-0.1,-0.1,.5);
    this.recordButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.recordButton.onPointerDownObservable.add( () => this.startStopCancel());

    this.editButton = new BABYLON.GUI.HolographicButton("EditPath");
    this.editButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Edit.png"; // FIXME: cdn
    manager.addControl(this.editButton);
    this.editButton.position = new BABYLON.Vector3(0,-0.1,.5);
    this.editButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.editButton.onPointerDownObservable.add( () => this.edit());

    this.jsonButton = new BABYLON.GUI.HolographicButton("SavePathJson");
    this.jsonButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Download.png"; // FIXME: cdn
    manager.addControl(this.jsonButton);
    this.jsonButton.text="JSON";
    this.jsonButton.position = new BABYLON.Vector3(0.1,-0.1,.5);
    this.jsonButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.jsonButton.onPointerDownObservable.add( () => this.saveJson());

    this.jsButton = new BABYLON.GUI.HolographicButton("SavePathJs");
    this.jsButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Download.png"; // FIXME: cdn
    manager.addControl(this.jsButton);
    this.jsButton.text="JS";
    this.jsButton.position = new BABYLON.Vector3(0.2,-0.1,.5);
    this.jsButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.jsButton.onPointerDownObservable.add( () => this.saveJs());

    this.editButton.isVisible = false;
    this.jsonButton.isVisible = false;
    this.jsButton.isVisible = false;

    this.recordButton.mesh.parent = this.camera;
    this.editButton.mesh.parent = this.camera;
    this.jsonButton.mesh.parent = this.camera;
    this.jsButton.mesh.parent = this.camera;
  }
  startStopCancel() {
    if ( this.floorMesh ) {
      // cancel
      this.floorMesh.dispose();
      delete this.floorMesh;
      this.leftPath = [];
      this.rightPath = [];
      this.pathArray = [ this.leftPath, this.rightPath ];
    } else {
      this.recording = !this.recording;
      if ( this.recording ) {
        // start
        this.startRecording();
      } else {
        // stop
        this.createPath();
      }
    }
    this.updateUI();
  }
  updateUI() {
    if ( this.recording ) {
      this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Pause.png"; // FIXME: cdn
    } else if ( this.floorMesh) {
      this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Undo.png"; // FIXME: cdn
    } else {
      this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Play.png"; // FIXME: cdn
    }
    this.editButton.isVisible = !this.recording && this.floorMesh;
    this.jsonButton.isVisible = !this.recording && this.floorMesh;
    this.jsButton.isVisible = !this.recording && this.floorMesh;
  }
  trackActiveCamera() {
    var camera = this.scene.activeCamera;
    if ( camera ) {
      this.trackCamera(camera);
    }
  }
  startRecording() {
    this.leftPath = [];
    this.rightPath = [];
    this.pathArray = [ this.leftPath, this.rightPath ];
    this.trackActiveCamera();
  }
  trackCamera(camera) {
    console.log("Tracking camera");
    if ( camera ) {
      this.camera = camera;
    }
    this.lastX = this.camera.position.x;
    this.lastZ = this.camera.position.z;
    this.observer = this.camera.onViewMatrixChangedObservable.add((c) => this.viewChanged(c));

    this.left.parent = camera;
    this.right.parent = camera;
    var height = camera.ellipsoid.y*2;
    if ( this.camera.getClassName() == 'WebXRCamera' ) {
      var height = this.camera.realWorldHeight;
    }
    this.left.position = new BABYLON.Vector3(-1, -height, 0);
    this.right.position = new BABYLON.Vector3(1, -height, 0);
  }
  viewChanged(camera) {
    if (
      camera.position.x > this.lastX + this.size ||
      camera.position.x < this.lastX - this.size ||
      camera.position.z > this.lastZ + this.size ||
      camera.position.z < this.lastZ - this.size
    ) {
      //console.log("Pos: "+camera.position);
      //console.log("Pos left: "+this.left.absolutePosition+" right: "+this.right.absolutePosition);
      this.lastX = camera.position.x;
      this.lastZ = camera.position.z;
      if ( this.recording ) {
        this.leftPath.push( this.left.absolutePosition.clone() );
        this.rightPath.push( this.right.absolutePosition.clone() );
      }
    }
  }
  createPath() {
    if ( this.leftPath.length > 1 ) {
      this.addToScene();
    }
    this.camera.onViewMatrixChangedObservable.remove(this.observer);
    delete this.observer;
  }
  addToScene() {
    //var floorGroup = new BABYLON.TransformNode("floorGroup");
    //this.scene.addTransformNode( floorGroup );

    this.floorCount++;
    var floorMesh = BABYLON.MeshBuilder.CreateRibbon( "FloorRibbon"+this.floorCount, {pathArray: this.pathArray, updatable: true}, this.scene );
    floorMesh.material = this.floorMaterial;
    floorMesh.checkCollisions = false;
    this.floorMesh = floorMesh;
  }
  clear(){
    delete this.floorMesh;
    this.leftPath = [];
    this.rightPath = [];
    this.pathArray = [ this.leftPath, this.rightPath ];
    this.updateUI();
  }
  edit() {
    if ( ! this.floorMesh ) {
      return;
    }
    this.recordButton.isVisible = this.editing;
    this.jsonButton.isVisible = this.editing;
    this.jsButton.isVisible = this.editing;
    this.editing = !this.editing;
    if ( this.resizing ) {
      scene.onPointerObservable.remove( this.observer );
      this.resizing = false;
      delete this.observer;
      delete this.pathPoints;
      delete this.point1;
      delete this.point2;
      this.editButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Edit.png"; // FIXME: cdn
      if ( this.edgeMesh ) {
        this.edgeMesh.dispose();
        delete this.edgeMesh;
      }
    } else if ( this.editing ) {
      this.editButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Back.png"; // FIXME: cdn
      this.editButton.text = "Pick 1";
      this.resizing = true;
      this.observer = scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if(pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh == this.floorMesh) {
              if ( ! this.point1 ) {
                this.point1 = this.pickClosest(pointerInfo.pickInfo);
                this.editButton.text = "Pick 2";
              } else if ( ! this.point2 ) {
                this.point2 = this.pickClosest(pointerInfo.pickInfo);
                this.selectEdge();
                this.editButton.text = "Drag";
              } else {
                this.pickedPoint = this.pickClosest(pointerInfo.pickInfo);
                this.editButton.imageUrl = "/content/icons/tick.png";
                this.editButton.text = null;
              }
            }
            break;
          case BABYLON.PointerEventTypes.POINTERUP:
            delete this.pickedPoint;
            break;
          case BABYLON.PointerEventTypes.POINTERMOVE:
            if ( this.pickedPoint && pointerInfo.pickInfo.pickedMesh == this.floorMesh ) {
              this.resizeRibbon( pointerInfo.pickInfo.pickedPoint );
            }
            break;
          }
      });
    } else if ( this.observer ) {
      this.editButton.text = null;
      scene.onPointerObservable.remove( this.observer );
    }
  }
  pickClosest( pickInfo ) {
    var pickedIndex = 0;
    var pickedLeft = false;
    var path;
    var pathPoint;
    var min = 100000;
    for ( var i = 0; i < this.leftPath.length; i++ ) {
      var leftDistance = pickInfo.pickedPoint.subtract( this.leftPath[i] ).length();
      var rightDistance = pickInfo.pickedPoint.subtract( this.rightPath[i] ).length();
      if ( leftDistance < min ) {
        min = leftDistance;
        pickedLeft = true;
        pickedIndex = i;
        path = this.leftPath;
        pathPoint = this.leftPath[i];
      }
      if ( rightDistance < min ) {
        min = rightDistance;
        pickedLeft = false;
        pickedIndex = i;
        path = this.rightPath;
        pathPoint = this.rightPath[i];
      }
    }
    var ret = {
      index: pickedIndex,
      path: path,
      left: pickedLeft,
      pathPoint: pathPoint,
      point: pickInfo.pickedPoint.clone()
    };
    console.log("Picked left: "+pickedLeft+" index: "+pickedIndex+"/"+path.length+" distance: "+min);
    return ret;
  }
  selectEdge() {
    if ( this.point1.index > this.point2.index ) {
      var tmp = this.point2;
      this.point2 = this.point1;
      this.point1 = tmp;
    }
    var points = []
    for ( var i = this.point1.index; i <= this.point2.index; i++ ) {
      if ( this.point1.left ) {
        points.push( this.leftPath[i] );
      } else {
        points.push( this.rightPath[i] );
      }
    }
    this.pathPoints = points;
    if ( this.pathPoints.length > 1 ) {
      this.edgeMesh = BABYLON.MeshBuilder.CreateLines("FloorEdge", {points: points, updatable: true}, this.scene );
    } else {
      this.edgeMesh = BABYLON.MeshBuilder.CreateSphere("FloorEdge", {diameter:0.1}, this.scene);
      this.edgeMesh.position = this.pathPoints[0];
    }
  }
  resizeRibbon(point) {
    var diff = point.subtract(this.pickedPoint.point);
    for (var i = 0; i < this.pathPoints.length; i++ ) {
      this.pathPoints[i].addInPlace(diff);
    }
    this.pickedPoint.point = point.clone();
    // update the ribbon
    // seems buggy:
    //BABYLON.MeshBuilder.CreateRibbon( "FloorRibbon"+this.floorCount, {pathArray: this.pathArray, instance: this.floorMesh});
    var floorMesh = BABYLON.MeshBuilder.CreateRibbon( "FloorRibbon"+this.floorCount, {pathArray: this.pathArray, updatable: true}, this.scene );
    floorMesh.material = this.floorMaterial;
    floorMesh.checkCollisions = false;
    this.floorMesh.dispose();
    this.floorMesh = floorMesh;
    // update the edge
    if ( this.pathPoints.length > 1 ) {
      BABYLON.MeshBuilder.CreateLines("FloorEdge", {points: this.pathPoints, instance: this.edgeMesh} );
    }
  }
  saveJson() {
    var json = this.printJson();
    this.saveFile('FloorRibbon'+this.floorCount+'.json', json);
    this.clear();
  }
  saveJs() {
    var js = this.printJs();
    this.saveFile('FloorRibbon'+this.floorCount+'.js', js);
    this.clear();
  }
  printJson() {
    var ret = '{"pathArray":\n';
    ret += "[\n";
    ret += this.printPathJson(this.leftPath);
    ret += "\n],[\n";
    ret += this.printPathJson(this.rightPath);
    ret += "\n]}";
    console.log(ret);
    return ret;
  }
  printJs() {
    var ret = "BABYLON.MeshBuilder.CreateRibbon( 'FloorRibbon"+this.floorCount+"', {pathArray: \n";
    ret += "[[\n";
    ret += this.printPathJs(this.leftPath);
    ret += "\n],[\n";
    ret += this.printPathJs(this.rightPath);
    ret += "\n]]}, scene );";
    console.log(ret);
    return ret;
  }
  printPathJs(path) {
    var ret = "";
    for ( var i = 0; i < path.length-1; i++ ) {
      ret += "new BABYLON.Vector3("+path[i].x.toFixed(this.decimals)+","+path[i].y.toFixed(this.decimals)+","+path[i].z.toFixed(this.decimals)+"),";
    }
    ret += "new BABYLON.Vector3("+path[path.length-1].x.toFixed(this.decimals)+","+path[path.length-1].y.toFixed(this.decimals)+","+path[path.length-1].z.toFixed(this.decimals)+")";
    return ret;
  }
  printPathJson(path) {
    var ret = "";
    for ( var i = 0; i < path.length-1; i++ ) {
      ret += "["+path[i].x.toFixed(this.decimals)+","+path[i].y.toFixed(this.decimals)+","+path[i].z.toFixed(this.decimals)+"],";
    }
    ret += "["+path[path.length-1].x.toFixed(this.decimals)+","+path[path.length-1].y.toFixed(this.decimals)+","+path[path.length-1].z.toFixed(this.decimals)+"]";
    return ret;
  }
  saveFile(filename, content) {
    var a = document.createElement('a');
    var blob = new Blob([content], {'type':'application/octet-stream'});
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
}

export class Buttons {
  constructor(scene,title,options,callback,property) {
    this.scene = scene;
    this.title = title;
    this.options = options;
    this.callback = callback;
    this.property = property;
    this.buttonHeight = 1;
    this.color = "white";
    this.addBackground = false; // experimental
    this.group = new BABYLON.TransformNode("ButtonGroup:"+this.title, scene);
    this.groupWidth = 0;
    this.buttons = [];
    this.selectedOption = -1;
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.turOff = false;
    this.controls = [];
    this.textures = [];
    this.materials = [];
    this.display();
  }

  dispose() {
    delete this.selectedMaterial;
    delete this.unselectedMaterial;
    this.group.dispose();
    for ( var i = 0; i < this.controls.length; i++ ) {
      this.controls[i].dispose();
    }
    for ( var i = 0; i < this.textures.length; i++ ) {
      this.textures[i].dispose();
    }
    for ( var i = 0; i < this.materials.length; i++ ) {
      this.materials[i].dispose();
    }
    console.log("Disposed of buttons "+this.title);
  }

  setHeight(height) {
    var scale = height/this.options.length;
    this.group.scaling = new BABYLON.Vector3(scale, scale, scale);
  }

  display() {
    var buttonHeight = 1;
    var spacing = 1.1;

    // CHECKME: better use emissive color?
    this.selectedMaterial = new BABYLON.StandardMaterial("selectedButtonMaterial", scene);
    this.selectedMaterial.diffuseColor = new BABYLON.Color3(0,0,0);
    this.selectedMaterial.emissiveColor = new BABYLON.Color3(.4,.8,.4);
    this.selectedMaterial.disableLighting = true;
    this.materials.push(this.selectedMaterial);
    this.unselectedMaterial = new BABYLON.StandardMaterial("unselectedButtonMaterial", scene);
    this.unselectedMaterial.diffuseColor = new BABYLON.Color3(0,0,0);
    this.unselectedMaterial.emissiveColor = new BABYLON.Color3(.2,.2,.2);
    this.unselectedMaterial.disableLighting = true;
    this.materials.push(this.unselectedMaterial);

    if ( this.title && this.title.length > 0 ) {
      var titleText = new BABYLON.GUI.TextBlock();
      titleText.text = this.title;
      titleText.textHorizontalAlignment = this.horizontalAlignment;
      titleText.textVerticalAlignment = this.verticalAlignment;
      titleText.color = this.color;

      var titlePlane = BABYLON.MeshBuilder.CreatePlane("Text"+this.title, {height:2,width:this.title.length*2}, scene);
      titlePlane.parent = this.group;
      titlePlane.position = new BABYLON.Vector3(this.title.length,spacing*2,0);

      var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        titlePlane,
        titleText.fontSizeInPixels * titleText.text.length,
        titleText.fontSizeInPixels,
        false // mouse events disabled
      );
      titleTexture.addControl(titleText);
      this.controls.push(titleText);
      this.textures.push(titleTexture);
      this.materials.push(titlePlane.material);
    }

    for ( var i = 0; i < this.options.length; i ++ ) {
      if ( this.property ) {
        var option = this.options[i][this.property];
      } else {
        var option = this.options[i];
      }
      this.groupWidth = Math.max( this.groupWidth, option.length);
      var buttonText = new BABYLON.GUI.TextBlock();
      buttonText.text = option;
      buttonText.textHorizontalAlignment = this.horizontalAlignment;
      buttonText.textVerticalAlignment = this.verticalAlignment;

      var buttonWidth = buttonText.text.length;
      var buttonPlane = BABYLON.MeshBuilder.CreatePlane("Text"+option, {height:1,width:buttonWidth}, scene);
      buttonPlane.position = new BABYLON.Vector3(buttonWidth/2+buttonHeight,-i*spacing,0);
      buttonText.color = this.color;
      buttonPlane.parent = this.group;

      var aTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        buttonPlane,
        buttonText.fontSizeInPixels*buttonText.text.length, // CHECKME: this is about twice the size of the text
        buttonText.fontSizeInPixels+2, // CHECKME: padding or something?
        false // mouse events disabled
      );
      //aTexture.background="black";
      aTexture.addControl(buttonText);
      this.controls.push(buttonText);
      this.textures.push(aTexture);
      // buttonPlane.material.needDepthPrePass = true; // trying to get proper transparency
      buttonPlane.material.alphaMode = 5; // ALPHA_MAXIMIZED
      this.materials.push(buttonPlane.material);

      var button = BABYLON.MeshBuilder.CreateCylinder("Button"+option, {height:.1, diameter:buttonHeight*.8}, scene);
      button.material = this.unselectedMaterial;
      button.rotation = new BABYLON.Vector3(Math.PI/2, 0, 0);
      button.position = new BABYLON.Vector3(buttonHeight/2, -i*spacing, 0);
      button.parent = this.group;
      this.buttons.push(button);
    }

    scene.onPointerObservable.add( (e) => {
      if(e.type == BABYLON.PointerEventTypes.POINTERDOWN){
        var p = e.pickInfo;
        for ( var i = 0; i < this.options.length; i++ ) {
          if ( p.pickedMesh == this.buttons[i] ) {
            // CHECKME we may want to handle double click somehow
            if ( i != this.selectedOption || this.turnOff) {
              this.select(i);
            }
            break;
          }
        }
      }
    });

    // paints background plane, can't be semi-transparent though
    if ( this.addBackground ) {
      console.log("Group width: "+this.groupWidth);
      var backgroundWidth = this.groupWidth/1.8;
      var backgroundHeight = this.options.length*spacing;
      var backgroundOffset = buttonHeight*.8; // same as button cylinder diameter
      var backPlane = BABYLON.MeshBuilder.CreatePlane("ButtonBackground:"+this.title, {height:backgroundHeight,width:backgroundWidth}, scene);
      backPlane.position = new BABYLON.Vector3(backgroundWidth/2+backgroundOffset,-backgroundHeight/2+spacing/2,.2);
      backPlane.parent = this.group;
      var backgroundMaterial = new BABYLON.StandardMaterial("unselectedButtonMaterial", scene);
      backgroundMaterial.disableLighting = true;
      //backgroundMaterial.alpha = 0.5; // produces weird transparency effects
      this.materials.push(backgroundMaterial);
      backPlane.material = backgroundMaterial;
    }
  }
  
  select(i) {
    console.log("Selected: "+this.options[i].name);
    if ( this.callback ) {
      this.callback(this.options[i]);
    }
    this.buttons[i].material = this.selectedMaterial;
    if ( this.selectedOption > -1 ) {
      this.buttons[this.selectedOption].material = this.unselectedMaterial;
    }
    if ( i != this.selectedOption ) {
      this.selectedOption = i;
    } else {
      this.selectedOption = -1;
    }
  }
  
  // CHECKME: not used so far
  hide() {
    this.group.isEnabled = false;
  }

  show() {
    this.group.isEnabled = true;
  }
}

export class VRHelper {
  async initXR(world) {
    this.world = world;
    var xrHelper = this.vrHelper;
    if ( this.vrHelper ) {
      console.log("VR helper already intialized");
      this.addFloors();
    } else {
      try {
        xrHelper = await this.world.scene.createDefaultXRExperienceAsync({floorMeshes: this.world.getFloorMeshes()});        
      } catch ( err ) {
        console.log("Can't init XR:"+err);
      }
    }

    if (xrHelper && xrHelper.baseExperience) {
      console.log("Using XR helper");
      this.vrHelper = xrHelper;

      // updating terrain after teleport
      if ( this.movementObserver ) {
        // remove existing teleportation observer
        xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.remove( this.movementObserver );
      }
      this.movementObserver = () => { this.afterTeleportation() };
      xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.add( this.movementObserver );

      if ( !this.initialPoseObserver ) {
        this.initialPoseObserver = (xrCamera) => {
          // TODO restore this after exit VR
          xrCamera.position.y = this.world.camera.position.y - this.world.camera.ellipsoid.y*2;
        };
        xrHelper.baseExperience.onInitialXRPoseSetObservable.add( this.initialPoseObserver ); 
      }

      if ( this.tracker ) {
        this.stopTracking();
      }
      this.tracker = () => this.world.trackXrDevices();
      
      if ( !this.stateChangeObserver ) {
        this.stateChangeObserver = (state) => {
          console.log( "State: "+state );
          switch (state) {
            case BABYLON.WebXRState.IN_XR:
              // XR is initialized and already submitted one frame
              console.log( "Entered VR" );
              this.startTracking();
              // Workaround for teleporation/selection bug
              xrHelper.teleportation.setSelectionFeature(null);
              this.world.inXR = true;
              break;
            case BABYLON.WebXRState.ENTERING_XR:
              // xr is being initialized, enter XR request was made
              console.log( "Entering VR" );
              this.world.collisions(false);
              break;
            case BABYLON.WebXRState.EXITING_XR:
              console.log( "Exiting VR" );
              this.stopTracking();
              // doesn't do anything
              //camera.position.y = xrHelper.baseExperience.camera.position.y + 3; //camera.ellipsoid.y*2;
              this.world.collisions(this.world.collisionsEnabled);
              this.world.inXR = false;
              break;
            case BABYLON.WebXRState.NOT_IN_XR:
              console.log( "Not in VR" );
              this.world.attachControl();
              this.world.scene.activeCamera = this.world.camera;
              // self explanatory - either out or not yet in XR
              break;
          }
        };
        xrHelper.baseExperience.onStateChangedObservable.add(this.stateChangeObserver);
      }

      // CHECKME: really ugly way to make it work
      this.world.scene.pointerMovePredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };
      xrHelper.pointerSelection.raySelectionPredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };

      xrHelper.teleportation.rotationEnabled = false; // CHECKME
      //xrHelper.teleportation.parabolicRayEnabled = false; // CHECKME

      if ( !this.controllerObserver ) {
        this.controllerObserver = (xrController) => {
          console.log("Controller added: "+xrController.grip.name+" "+xrController.grip.name);
          console.log(xrController);
          if ( xrController.grip.id.toLowerCase().indexOf("left") >= 0 || xrController.grip.name.toLowerCase().indexOf("left") >=0 ) {
            this.leftController = xrController;
          } else if (xrController.grip.id.toLowerCase().indexOf("right") >= 0 || xrController.grip.name.toLowerCase().indexOf("right") >= 0) {
            this.rightController = xrController;
          } else {
            log("ERROR: don't know how to handle controller");
          }
        };
        xrHelper.input.onControllerAddedObservable.add(this.controllerObserver);
      }
      
      
    } else {
      // obsolete and unsupported TODO REMOVEME
      this.vrHelper = this.world.scene.createDefaultVRExperience({createDeviceOrientationCamera: false });
      //vrHelper.enableInteractions();
      this.vrHelper.webVRCamera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
      this.vrHelper.onEnteringVRObservable.add(()=>{this.world.collisions(false)});
      this.vrHelper.onExitingVRObservable.add(()=>{this.world.collisions(this.world.collisionsEnabled);});

      this.vrHelper.enableTeleportation({floorMeshes: this.world.getFloorMeshes(this.world.scene)});
      this.vrHelper.raySelectionPredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };
      
      this.vrHelper.onBeforeCameraTeleport.add((targetPosition) => {
        this.world.camera.globalPosition.x = targetPosition.x;
        this.world.camera.globalPosition.y = targetPosition.y;
        this.world.camera.globalPosition.z = targetPosition.z;
        if ( this.world.terrain ) {
          this.world.terrain.update(true);
        }
      });
      
    }
  }
  
  afterTeleportation() {
    var targetPosition = this.vrHelper.baseExperience.camera.position;
    this.world.camera.globalPosition.x = targetPosition.x;
    this.world.camera.globalPosition.y = targetPosition.y;
    this.world.camera.globalPosition.z = targetPosition.z;
    if ( this.world.terrain ) {
      this.world.terrain.update(false);
    }
    // TODO we can modify camera y here, adding terrain height on top of ground height
  }
  
  startTracking() {
    scene.registerBeforeRender(this.tracker);
  }
  stopTracking() {
    scene.unregisterBeforeRender(this.tracker);
  }
  camera() {
    return this.vrHelper.input.xrCamera;
  }
  addFloorMesh(mesh) {
    if ( this.vrHelper && this.vrHelper.teleportation) {
      this.vrHelper.teleportation.addFloorMesh(mesh);
    }
  }
  removeFloorMesh(mesh) {
    if ( this.vrHelper && this.vrHelper.teleportation) {
      this.vrHelper.teleportation.removeFloorMesh(mesh);
    }
  }
  raySelectionPredicate(predicate) {
    var ret = this.vrHelper.pointerSelection.raySelectionPredicate;
    if ( predicate ) {
      this.vrHelper.pointerSelection.raySelectionPredicate = predicate;
    }
    return ret;
  }
  clearFloors() {
    for ( var i = 0; i < this.world.getFloorMeshes().length; i++ ) {
      this.removeFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }
  addFloors() {
    for ( var i = 0; i < this.world.getFloorMeshes().length; i++ ) {
      this.addFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }
}

// this is intended to be overridden
export class World {
  async init(engine, name, scene, callback, baseUrl, file) {
    this.canvas = engine.getInputElement();
    this.engine = engine;
    this.name = name;
    this.scene = scene;
    this.vrHelper = null;
    if ( file ) {
      this.file = file;
    } else if ( !this.file ){
      this.file = "scene.gltf";
    }
    if ( baseUrl ) {
      this.baseUrl = baseUrl;
    } else if ( !this.baseUrl ){
      this.baseUrl = "";
    }
    this.gravityEnabled = true;
    this.collisionsEnabled = true;
    await this.createScene(engine);
    if ( ! this.onProgress ) {
      this.indicator = VRSPACEUI.loadProgressIndicator(this.scene, this.camera);
      this.onProgress = (evt, name) => this.indicator.progress( evt, name )
    }
    this.registerRenderLoop();
    this.createTerrain();
    this.load(callback);
    return this.scene;
  }
  async createScene(engine) {
    if ( ! this.scene ) {
      this.scene = new BABYLON.Scene(engine);
    }
    // TODO dispose of old camera(s)
    var camera = await this.createCamera();
    if ( camera ) {
      this.camera = camera;
    }
    this.attachControl();
    // TODO dispose of old lights
    var light = await this.createLights();
    if ( light ) {
      this.light = light;
    }
    // TODO dispose of old shadow generator
    var shadowGenerator = await this.createShadows();
    if ( shadowGenerator ) {
      this.shadowGenerator = shadowGenerator;
    }
    // TODO dispose of old skybox
    var skyBox = await this.createSkyBox();
    if ( skyBox ) {
      this.skyBox = skyBox;
    }
    // TODO dispose of old ground
    var ground = await this.createGround();
    if ( ground ) {
      this.ground = ground;
    }
    await this.createEffects();
    await this.createPhysics();
  }
  async createCamera() {
    alert( 'Please override createCamera() method')
  }
  async createLights() {}
  async createShadows() {}
  async createSkyBox() {}
  async createGround() {}
  async createEffects() {};
  async createPhysics() {};
  async createTerrain() {}
  
  // utility method, creates camera and sets defaults
  universalCamera(pos, name) {
    if ( !name ) {
      name = "UniversalCamera";
    } 
    var camera = new BABYLON.UniversalCamera(name, pos, this.scene);
    camera.maxZ = 100000;
    camera.minZ = 0;
    camera.applyGravity = true;
    camera.speed = 0.2;
    // 1.8 m high:
    camera.ellipsoid = new BABYLON.Vector3(.5, .9, .5);
    // eyes at 1.6 m:
    camera.ellipsoidOffset = new BABYLON.Vector3(0, .2, 0);
    camera.checkCollisions = true;
    
    camera.keysDown = [40, 83]; // down, S
    camera.keysLeft = [37, 65]; // left, A
    camera.keysRight = [39, 68]; // right, D
    camera.keysUp = [38, 87]; // up, W
    camera.keysUpward = [36, 33, 32]; // home, pgup, space
    
    return camera;    
  }
  
  async dispose() {
    if ( this.camera ) {
      this.camera.dispose();
      this.camera = null;    
    }
    if ( this.skyBox ) {
      this.skyBox.dispose();
      this.skyBox.material.dispose();
      this.skyBox = null;    
    }
    if ( this.light ) {
      this.light.dispose();
      this.light = null;
    }
    if ( this.shadowGenerator ) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;    
    }
    if ( this.scene && this.scene.lights ) {
      this.scene.lights.forEach( (l) => {
        l.dispose();
      });
    }
  }
  
  initXR() {
    if ( ! this.vrHelper ) {
      this.vrHelper = new VRHelper();
    }
    this.vrHelper.initXR(this);
  }
  trackXrDevices() {
  }
  
  isSelectableMesh(mesh) {
    return this.floorMeshes && this.floorMeshes.includes(mesh);
  }

  getFloorMeshes() {
    if ( this.floorMeshes ) {
      return this.floorMeshes;      
    }
    return [];
  }
  
  collisions(state) {
    this._collisions( this.floorMeshes, this.collisionsEnabled && state );
    this._collisions( this.sceneMeshes, this.collisionsEnabled && state );
    this.camera.applyGravity = this.gravityEnabled && state;
    this.camera._needMoveForGravity = this.gravityEnabled && state;
  }
  
  _collisions( meshes, state ) {
    if ( meshes ) {
      for ( var i=0; i<meshes.length; i++ ) {
        this.setMeshCollisions( meshes[i], state );
      }
    }
  }
  
  setMeshCollisions(mesh, state) {
    mesh.checkCollisions = state;    
  }
  
  loadProgress( evt, name ) {
    if ( this.onProgress ) {
      this.onProgress( evt, name );
    }
  }
  loadingStart(name) {
    if ( this.indicator ) {
      this.indicator.add(name);
    }
  }
  loadingStop(name) {
    if ( this.indicator ) {
      this.indicator.remove(name);
    }
  }
  
  load(callback) {
    this.loadingStart(name);

    BABYLON.SceneLoader.LoadAssetContainer(this.baseUrl,
      this.file,
      this.scene,
      // onSuccess:
      (container) => {
        this.sceneMeshes = container.meshes;
        this.container = container;

        // Adds all elements to the scene
        var mesh = container.createRootMesh();
        mesh.name = this.name;
        container.addAllToScene();
      
        this.loaded( this.file, mesh );

        // do something with the scene
        VRSPACEUI.log("World loaded");
        this.loadingStop(this.name);
        //floor = new FloorRibbon(scene);
        //floor.showUI();
        this.collisions(this.collisionsEnabled);
        if ( callback ) {
          callback(this);
        }
      },
      // onProgress:
      (evt) => { this.loadProgress(evt, name) }
    );
    
    return this;
  }
  
  loaded( file, mesh ) {
    this.initXR();
  }
  
  registerRenderLoop() {
    // Register a render loop to repeatedly render the scene
    var loop = () => {
      if ( this.scene ) {
        this.scene.render();
      } else {
        this.engine.stopRenderLoop(loop);
      }
    }
    this.engine.runRenderLoop(loop);
  }

  async loadAsset(relativePath, file, scene) {
    return BABYLON.SceneLoader.LoadAssetContainerAsync(this.assetPath(relativePath), file, scene);
  }
  
  assetPath(relativePath) {
    return this.baseUrl+relativePath;
  }
  
  attachControl() {
    this.camera.attachControl(this.canvas, true);
  }
}

export class WorldManager {
  constructor(world, fps) {
    this.resolution = 0.01; // 1 cm/3.6 deg 
    this.world = world;
    this.scene = world.scene;
    this.customOptions = null; // custom video avatar options
    this.trackRotation = true; // turn off to optimize e.g. video avatars
    this.mesh = null; // used in 3rd person view
    this.mediaStreams = null; // this is set once we connect to streaming server
    this.changeCallback = null;
    this.avatarFactory = this.createAvatar;
    this.defaultPosition = new BABYLON.Vector3( 1000, 1000, 1000 );
    this.defaultRotation = new BABYLON.Vector3( 0, 0, 0 );
    if ( ! this.scene.activeCamera ) {
      console.log("Undefined camera in WorldManager, tracking disabled")
    } else {
      this.trackCamera();
    }
    this.scene.onActiveCameraChanged.add( () => { this.trackCamera() } );
    this.VRSPACE = VRSPACE;
    if ( fps ) {
      this.fps = fps
    } else {
      this.fps = 5;
    }
    this.pos = { x: null, y: null, z: null };
    this.rot = { x: null, y: null, z: null };
    this.leftArmPos = { x: null, y: null, z: null };
    this.rightArmPos = { x: null, y: null, z: null };
    this.leftArmRot = { x: null, y: null, z: null, w: null };
    this.rightArmRot = { x: null, y: null, z: null, w: null };
    this.interval = null;
    VRSPACE.addConnectionListener((connected) => this.setConnected(connected));
    VRSPACE.addSceneListener((e) => this.sceneChanged(e));
    this.debug = false;
  }

  pubSub( client, autoPublishVideo ) {
    this.log("Subscribing as client "+client.id+" with token "+client.token);
    if ( client.token ) {
      // obtain token and start pub/sub voices
      if ( ! this.mediaStreams ) {
        this.mediaStreams = new MediaStreams(this.scene, 'videos');
      }
      if ( autoPublishVideo ) {
        this.mediaStreams.startVideo = true;
        this.mediaStreams.videoSource = undefined;
      }
      this.mediaStreams.connect(client.token).then(() => this.mediaStreams.publish());
    }
  }
  
  log( what ) {
    if (this.debug) {
      console.log(what);
    }
  }
  
  trackMesh(mesh) {
    if ( mesh ) {
      this.log("Tracking mesh "+mesh.id);
    } else if ( this.mesh ) {
      this.log("Stopped tracking mesh "+this.mesh.id);
    }
    this.mesh = mesh;
  }
  
  trackCamera(camera) {
    if ( ! camera ) {
      camera = this.scene.activeCamera;
    }
    if ( camera ) {
      this.log("Tracking camera "+camera.getClassName())
      this.camera = camera;
    }
  }
  
  setConnected(connected) {
    this.log("Connected: "+connected);
    if ( connected ) {
      this.interval = setInterval(() => this.trackChanges(), 1000/this.fps);        
    } else if ( this.interval ) {
      clearInterval( this.interval );
      this.interval = null;
    }
  }
  
  isConnected() {
    return this.interval != null;
  }

  sceneChanged(e) {
    if (e.added != null) {
      this.log("ADDED " + e.objectId + " new size " + e.scene.size);
      this.log(e);
      // FIXME: need better way to determine avatar type
      if ( e.added.hasAvatar && e.added.hasAvatar()) {
        this.loadAvatar( e.added );
      } else if ("video" === e.added.mesh) {
        this.loadStream( e.added );
      } else if (e.added.mesh) {
        this.loadMesh(e.added);
      } else {
        // TODO server needs to ensure that mesh exists
        // in the meantime we define default behavior here
        console.log("ERROR: can't load "+e.objectId+" - no mesh")
      }
    } else if (e.removed != null) {
      this.log("REMOVED " + e.objectId + " new size " + e.scene.size)
      this.removeMesh( e.removed );
    } else {
      this.log("ERROR: invalid scene event");
    }
  }

  createAvatar(obj) {
    return new VideoAvatar(this.scene, null, this.customOptions);
  }
  
  loadStream( obj ) {
    this.log("loading stream for "+obj.id);
    
    var video = this.avatarFactory(obj);
    video.autoStart = false;
    video.autoAttach = false;
    if ( obj.name ) {
      video.altText = obj.name;    
    } else {
      video.altText = "u"+obj.id;
    }
    video.show();
    video.mesh.name = obj.mesh;
    video.mesh.id = obj.constructor.name+" "+obj.id;
    obj.video = video;
    
    var parent = new BABYLON.TransformNode("Root of "+video.mesh.id, this.scene);
    video.mesh.parent = parent;
          
    this.log("Added stream "+obj.id);
    
    if ( obj.position.x == 0 && obj.position.y == 0 && obj.position.z == 0) {
      // avatar position has not yet been initialized, use default
      parent.position = new BABYLON.Vector3(this.defaultPosition.x,this.defaultPosition.y,this.defaultPosition.z); 
      obj.position = this.defaultPosition;
      var initialPosition = { position: {} };
      this.changeObject( obj, initialPosition, parent );
    } else {
      // apply known position
      parent.position = new BABYLON.Vector3(obj.position.x, obj.position.y, obj.position.z)
    }
    
    if ( obj.rotation ) {
      if ( obj.rotation.x == 0 && obj.rotation.y == 0 && obj.rotation.z == 0) {
        // avatar rotation has not yet been initialized, use default
        parent.rotation = new BABYLON.Vector3(this.defaultRotation.x,this.defaultRotation.y,this.defaultRotation.z); 
        obj.rotation = this.defaultRotation;
        var initialRotation = { rotation: {} };
        this.changeObject( obj, initialRotation, parent );
      } else {
        // apply known rotation
        parent.rotation = new BABYLON.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      }
    }
    
    obj.addListener((obj, changes) => this.changeObject(obj, changes, parent));
    if ( this.mediaStreams ) {
      this.mediaStreams.streamToMesh(obj, video.mesh);
    } else {
      console.log("WARNING: unable to stream to "+obj.id+" - no MediaStreams")
    }
  }
  
  loadAvatar(obj) {
    this.log("loading avatar "+obj.mesh);
    var pos = obj.mesh.lastIndexOf('/');
    var path = obj.mesh.substring(0,pos);
    var file = obj.mesh.substring(pos+1);
    // FIXME really bad way to parse path and create ServerFolder
    pos = path.lastIndexOf('/');
    var baseUrl = path.substring(0,pos+1);
    var dir = path.substring(pos+1);
    var fix = null; //TODO find if fix file exist
    var dir = new ServerFolder( baseUrl, dir, fix );
    var avatar = new Avatar(this.scene, dir);
    avatar.fps = this.fps;
    avatar.userHeight = obj.userHeight;
    avatar.debug = true;
    avatar.load( (c) => {
      // FIXME: this is not container but avatar
      obj.container = c;
      // apply current position and rotation
      this.changeAvatar(obj, { position: obj.position });
      if ( obj.rotation ) {
        // FIXME rotation can be null sometimes (offline users?)
        this.changeAvatar(obj, { rotation: obj.rotation });
      }
      // TODO also apply other properties here (name?)
      // add listener to process changes
      obj.addListener((obj, changes) => this.changeAvatar(obj, changes));
      // subscribe to media stream here if available
      if ( this.mediaStreams ) {
        this.mediaStreams.streamToMesh(obj, obj.container.rootMesh);        
      }
    });
  }
  
  changeAvatar(obj,changes) {
    this.log( 'Processing changes on avatar' );
    this.log(changes);
    var avatar = obj.container;
    for ( var field in changes ) {
      var node = avatar.rootMesh;
      if ( 'position' === field ) {
        if ( ! obj.translate ) {
          obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else if ( 'rotation' === field ) {
        if ( ! obj.rotate ) {
          obj.rotate = VRSPACEUI.createQuaternionAnimation(node, "rotationQuaternion", this.fps);
        }
        VRSPACEUI.updateQuaternionAnimation(obj.rotate, node.rotationQuaternion, obj.rotation);
      } else if ( 'leftArmPos' === field ) {
        var pos = new BABYLON.Vector3(obj.leftArmPos.x, obj.leftArmPos.y, obj.leftArmPos.z);
        avatar.reachFor(avatar.body.rightArm, pos);
        //avatar.reachFor(avatar.body.leftArm, pos);
      } else if ( 'rightArmPos' === field ) {
        var pos = new BABYLON.Vector3(obj.rightArmPos.x, obj.rightArmPos.y, obj.rightArmPos.z);
        //avatar.reachFor(avatar.body.rightArm, pos);
        avatar.reachFor(avatar.body.leftArm, pos);
      } else if ( 'leftArmRot' === field ) {
        // FIXME sometimes: Cannot read property 'x' of undefined
        //avatar.body.leftArm.pointerQuat = new BABYLON.Quaternion(obj.leftArmRot.x, obj.leftArmRot.y, obj.leftArmRot.z, obj.leftArmRot.w)
        avatar.body.leftArm.pointerQuat = new BABYLON.Quaternion(obj.rightArmRot.x, obj.rightArmRot.y, obj.rightArmRot.z, obj.rightArmRot.w)
      } else if ( 'rightArmRot' === field ) {
        // FIXME sometimes: Cannot read property 'x' of undefined
        //avatar.body.rightArm.pointerQuat = new BABYLON.Quaternion(obj.rightArmRot.x, obj.rightArmRot.y, obj.rightArmRot.z, obj.rightArmRot.w)
        avatar.body.rightArm.pointerQuat = new BABYLON.Quaternion(obj.leftArmRot.x, obj.leftArmRot.y, obj.leftArmRot.z, obj.leftArmRot.w)
      }
    }
  }

  // TODO loader UI
  loadMesh(obj) {
    this.log("Loading object "+obj.mesh);
    if ( ! obj.mesh ) {
      console.log("Null mesh of client "+obj.id);
      return;
    }
    var pos = obj.mesh.lastIndexOf('/');
    var path = obj.mesh.substring(0,pos+1);
    var file = obj.mesh.substring(pos+1);
    BABYLON.SceneLoader.LoadAssetContainerAsync(path, file, scene).then((container) => {
      this.log("loaded "+obj.mesh);
      var bbox = this.boundingBox(container);
      
      // Adds all elements to the scene
      var mesh = container.createRootMesh();
      mesh.name = obj.mesh;
      mesh.id = obj.constructor.name+" "+obj.id;
      
      container.addAllToScene();

      obj.container = container;
      
      this.log("Added "+obj.mesh);
      
      var initialPosition = { position: {} };
      this.changeObject( obj, initialPosition );

      // add listener to process changes
      obj.addListener((obj, changes) => this.changeObject(obj, changes));
    });
  }

  boundingBox(container) {
    var maxSize = new BABYLON.Vector3(0,0,0);
    for ( var i = 0; i < container.meshes.length; i++ ) {
      // have to recompute after scaling
      //container.meshes[i].computeWorldMatrix(true);
      container.meshes[i].refreshBoundingInfo();
      var boundingInfo = container.meshes[i].getBoundingInfo().boundingBox;
      console.log("max: "+boundingInfo.maximumWorld+" min: "+boundingInfo.minimumWorld);
      var size = new BABYLON.Vector3(
        boundingInfo.maximumWorld.x - boundingInfo.minimumWorld.x,
        boundingInfo.maximumWorld.y - boundingInfo.minimumWorld.y,
        boundingInfo.maximumWorld.z - boundingInfo.minimumWorld.z
        );
      maxSize.x = Math.max(maxSize.x,size.x);
      maxSize.y = Math.max(maxSize.y,size.y);
      maxSize.z = Math.max(maxSize.z,size.z);
      //if (shadows) {
        //shadowGenerator.getShadowMap().renderList.push(container.meshes[i]);
      //}
    }
    console.log("BBoxMax: "+maxSize);
    return maxSize;
  }
  
  changeObject(obj,changes, node) {
    this.log("Changes on "+obj.id+": "+JSON.stringify(changes));
    if ( ! node ) {
      node = obj.container.meshes[0];      
    }
    for ( var field in changes ) {
      if ( 'position' === field ) {
        if ( ! obj.translate ) {
          obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else if ( 'rotation' === field ) {
        if ( ! obj.rotate ) {
          obj.rotate = VRSPACEUI.createAnimation(node, "rotation", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.rotate, node.rotation, obj.rotation);
      } else {
        this.routeEvent( obj, field, node );
      }
    }
  }
  
  routeEvent(obj, field, node) {
    var object = obj;
    if ( obj.container ) {
      object = obj.container;
    } else if ( obj.video ) {
      object = obj.video;
    } else {
      console.log("Ignoring unknown event "+field+" to object "+obj.id);
      return;      
    }
    if (typeof object[field] === 'function') {
      object[field](obj);
    //} else if (object.hasOwnProperty(field)) {
    } else {
      console.log("Ignoring unknown event to "+obj+": "+field);
    }
  }

  removeMesh(obj) {
    if ( this.mediaStreams ) {
      this.mediaStreams.removeClient(obj);
    }
    if ( obj.container ) {
      obj.container.dispose();
      obj.container = null;
    }
    if ( obj.translate ) {
      obj.translate.dispose();
      obj.translate = null;
    }
    if ( obj.rotate ) {
      obj.rotate.dispose();
      obj.rotate = null;
    }
    if ( obj.streamToMesh ) {
      obj.streamToMesh.dispose();
      obj.streamToMesh = null;
    }
    // TODO also remove object (avatar) from internal arrays
  }

  trackChanges() {
    var changes = [];
    if ( this.mesh ) {
      // tracking mesh (3rd person view)
      var pos = this.mesh.position;
      if ( this.mesh.ellipsoid ) {
        var height = this.mesh.position.y - this.mesh.ellipsoid.y;
        pos = new BABYLON.Vector3(this.mesh.position.x, height, this.mesh.position.z);
      }
      this.checkChange("position", this.pos, pos, changes);
      this.checkChange("rotation", this.rot, this.mesh.rotation, changes);
    } else {
      // tracking camera (1st person view)
      if ( ! this.camera ) {
        return;
      }
      // track camera movements
      if ( this.camera.ellipsoid ) {
        var height = this.camera.globalPosition.y - this.camera.ellipsoid.y*2;
        if ( this.camera.ellipsoidOffset ) {
          height += this.camera.ellipsoidOffset.y;
        }
        this.checkChange("position", this.pos, new BABYLON.Vector3(this.camera.globalPosition.x, height, this.camera.globalPosition.z), changes);
      } else {
        this.checkChange("position", this.pos, this.camera.globalPosition, changes);
      }
      if ( this.trackRotation ) {
        var cameraRotation = this.camera.rotation;
        if ( this.camera.getClassName() == 'WebXRCamera' ) {
          // CHECKME do other cameras require this?
          cameraRotation = this.camera.rotationQuaternion.toEulerAngles();
        }
        this.checkChange("rotation", this.rot, cameraRotation, changes);
      }
      
      // and now track controllers
      var vrHelper = this.world.vrHelper;
      if ( vrHelper && vrHelper.leftController ) {
        this.checkChange( 'leftArmPos', this.leftArmPos, vrHelper.leftController.grip.absolutePosition, changes );
        this.checkChange( 'leftArmRot', this.leftArmRot, vrHelper.leftController.pointer.rotationQuaternion, changes );
      }
      if ( vrHelper && vrHelper.rightController ) {
        this.checkChange( 'rightArmPos', this.rightArmPos, vrHelper.rightController.grip.absolutePosition, changes );
        this.checkChange( 'rightArmRot', this.rightArmRot, vrHelper.rightController.pointer.rotationQuaternion, changes );
      }      
    }
    VRSPACE.sendMyChanges(changes);
    if ( this.changeCallback && changes.length > 0 ) {
      this.changeCallback(changes);
    }

  }
  
  checkChange( field, obj, pos, changes ) {
    // TODO: add minimal distance/angle change check
    // CHECKME: we don't check quaternion w, should we?
    if ( this.isChanged(obj.x, pos.x, this.resolution) || 
        this.isChanged(obj.y, pos.y, this.resolution) || 
        this.isChanged(obj.z, pos.z, this.resolution) ) {
      this.log( Date.now()+": "+field + " changed, sending "+pos);
      obj.x = pos.x;
      obj.y = pos.y;
      obj.z = pos.z;
      changes.push({ field: field, value: pos});
    }
  }
  isChanged( old, val, range ) {
    return val < old - range || val > old + range;
  }

}

export class MediaStreams {
  constructor(scene, htmlElementName) {
    this.scene = scene;
    // CHECKME null check that element?
    this.htmlElementName = htmlElementName;
    this.startAudio = true;
    this.startVideo = false;
    this.audioSource = undefined; // use default
    this.videoSource = false;     // disabled
    this.publisher = null;
    // this is to track/match clients and streams:
    this.clients = [];
    this.subscribers = [];    
  }
  
  async init( callback ) {
    await import('./openvidu-browser-2.15.0.js');
    this.OV = new OpenVidu();
    this.session = this.OV.initSession();
    this.session.on('streamCreated', (event) => {
      // client id can be used to match the stream with the avatar
      // server sets the client id as connection user data
      console.log("New stream "+event.stream.connection.connectionId+" for "+event.stream.connection.data)
      console.log(event);
      var subscriber = this.session.subscribe(event.stream, this.htmlElementName);
      subscriber.on('videoElementCreated', e => {
        console.log("Video element created:");
        console.log(e.element);
        e.element.muted = true; // mute altogether
      });
      subscriber.on('streamPlaying', event => {
        console.log('remote stream playing');
        console.log(event);
        if ( callback ) {
          callback( subscriber );
        }
      });
    });
  
    // On every new Stream destroyed...
    this.session.on('streamDestroyed', (event) => {
      // TODO remove from the scene
      console.log("Stream destroyed!")
      console.log(event);
    });
  }
  
  async connect(token) {
    token = token.replaceAll('&amp;','&');
    console.log('token: '+token);
    await this.init((subscriber) => this.streamingStart(subscriber));
    return this.session.connect(token);
  }
  
  // htmlElement is needed only for local feedback (testing)
  publish(htmlElementName) {
    this.publisher = this.OV.initPublisher(htmlElementName, {
      videoSource: this.videoSource,     // The source of video. If undefined default video input
      audioSource: this.audioSource,     // The source of audio. If undefined default audio input
      publishAudio: this.startAudio,   // Whether to start publishing with your audio unmuted or not
      publishVideo: this.startVideo    // Should publish video?
    });
    
    // this is only triggered if htmlElement is specified
    this.publisher.on('videoElementCreated', e => {
      console.log("Video element created:");
      console.log(e.element);
      e.element.muted = true; // mute altogether
    });

    // in test mode subscribe to remote stream that we're sending
    if ( htmlElementName ) {
      this.publisher.subscribeToRemote(); 
    }
    // publish own sound
    this.session.publish(this.publisher);
    // id of this connection can be used to match the stream with the avatar
    console.log("Publishing to connection "+this.publisher.stream.connection.connectionId);
    console.log(this.publisher);
  }
  
  publishVideo(enabled) {
    if ( this.publisher ) {
      console.log("Publishing video: "+enabled);
      this.publisher.publishVideo(enabled);
    }
  }

  publishAudio(enabled) {
    if ( this.publisher ) {
      console.log("Publishing audio: "+enabled);
      this.publisher.publishAudio(enabled);
    }
  }
  
  // TODO this assumes that 1) mesh is already loaded and 2) stream subscriber is already created
  attachAudioStream(mesh, mediaStream) {
    var audioTracks = mediaStream.getAudioTracks();
    if ( audioTracks && audioTracks.length > 0 ) {
      console.log("Attaching audio stream to mesh "+mesh.id);
      // see details of
      // https://forum.babylonjs.com/t/sound-created-with-a-remote-webrtc-stream-track-does-not-seem-to-work/7047/6
      var voice = new BABYLON.Sound(
        "voice",
        mediaStream,
        this.scene, null, {
          loop: false,
          autoplay: true,
          spatialSound: true,
          streaming: true,
          distanceModel: "linear",
          maxDistance: 50, // default 100, used only when linear
          panningModel: "equalpower" // or "HRTF"
        });
      voice.attachToMesh(mesh);
      
      var ctx = voice._inputAudioNode.context;
      var gainNode = voice.getSoundGain();
      voice._streamingSource.connect(voice._soundPanner);
      voice._soundPanner.connect(gainNode);
      gainNode.connect(ctx.destination);      
    }
  }
  
  getClientId(subscriber) {
    return parseInt(subscriber.stream.connection.data,10);
  }
  
  getStream(subscriber) {
    return subscriber.stream.getMediaStream();
  }

  removeClient( client ) {
    for ( var i = 0; i < this.clients.length; i++) {
      if ( this.clients[i].id == client.id ) {
        this.clients.splice(i,1);
        console.log("Removed client "+client.id);
        break;
      }
    }
    var oldSize = this.subscribers.length;
    // one client can have multiple subscribers, remove them all
    this.subscribers = this.subscribers.filter(subscriber => this.getClientId(subscriber) != client.id);
    console.log("Removed "+(oldSize-this.subscribers.length)+" subscribers, new size "+this.subscribers.length);
  }
  
  streamingStart( subscriber ) {
    var id = this.getClientId(subscriber);
    console.log("Stream started for client "+id)
    for ( var i = 0; i < this.clients.length; i++) {
      var client = this.clients[i];
      if ( client.id == id ) {
        // matched
        this.attachAudioStream(client.streamToMesh, this.getStream(subscriber));
        //this.clients.splice(i,1); // too eager, we may need to keep it for another stream
        console.log("Audio/video stream started for avatar of client "+id)
        this.attachVideoStream(client, subscriber);
        break;
      }
    }
    this.subscribers.push(subscriber);
  }
  
  streamToMesh(client, mesh) {
    console.log("Loaded avatar of client "+client.id)
    client.streamToMesh = mesh;
    for ( var i = 0; i < this.subscribers.length; i++) {
      var subscriber = this.subscribers[i];
      var id = this.getClientId(subscriber);
      if ( client.id == id ) {
        // matched
        this.attachAudioStream(mesh, this.getStream(subscriber));
        this.attachVideoStream(client, subscriber);
        //this.subscribers.splice(i,1);
        console.log("Audio/video stream connected to avatar of client "+id)
        //break; // don't break, there may be multiple streams
      }
    }
    this.clients.push(client);
  }

  attachVideoStream(client, subscriber) {
    if ( client.video ) {
      var mediaStream = subscriber.stream.getMediaStream();
      // optional: also stream video as diffuseTexture
      if ( subscriber.stream.hasVideo && subscriber.stream.videoActive) {
        console.log("Streaming video texture")
        client.video.displayStream(mediaStream);
      }
      subscriber.on('streamPropertyChanged', event => {
        // "videoActive", "audioActive", "videoDimensions" or "filter"
        console.log('Stream property changed: ');
        console.log(event);
        if ( event.changedProperty === 'videoActive') {
          if ( event.newValue && event.stream.hasVideo ) {
            client.video.displayStream(mediaStream);
          } else {
            client.video.displayText();
          }
        }
      });
    }
  }  
  
}

export class VideoAvatar {
  constructor( scene, callback, customOptions ) {
    this.scene = scene;
    this.callback = callback;
    this.deviceId = null;
    this.radius = 1;
    this.altText = "N/A";
    this.textStyle = "bold 64px monospace";
    this.textColor = "black";
    this.backColor = "white";
    this.maxWidth = 640;
    this.maxHeight = 640;
    this.autoStart = true;
    this.autoAttach = true;
    this.attached = false;
    if ( customOptions ) {
      for(var c of Object.keys(customOptions)) {
        this[c] = customOptions[c];
      }
    }
  }
  async show() {
    if ( ! this.mesh ) {
      if ( this.autoAttach ) {
        this.cameraTracker = () => this.cameraChanged();        
      }
      this.mesh = BABYLON.MeshBuilder.CreateDisc("VideoAvatar", {radius:this.radius}, this.scene);
      //mesh.visibility = 0.95;
      this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      this.mesh.position = new BABYLON.Vector3( 0, this.radius, 0);
      this.mesh.material = new BABYLON.StandardMaterial("WebCamMat", this.scene);
      this.mesh.material.emissiveColor = new BABYLON.Color3.White();
      this.mesh.material.specularColor = new BABYLON.Color3.Black();
 
      // used for collision detection (3rd person view)
      this.mesh.ellipsoid = new BABYLON.Vector3(this.radius, this.radius, this.radius);

      // glow layer may make the texture invisible, needd to turn of glow for the mesh
      if ( this.scene.effectLayers ) {
        this.scene.effectLayers.forEach( (layer) => {
          if ( 'GlowLayer' === layer.getClassName() ) {
            layer.addExcludedMesh(this.mesh);
          }
        });
      }     
      // display alt text before video texture loads:
      this.displayText();
    
      if ( this.autoStart ) {
        await this.displayVideo();
      }
    }
  }
  
  dispose() {
    if ( this.mesh.parent ) {
      this.mesh.parent.dispose();
    }
    if ( this.mesh ) {
      this.mesh.dispose();
      delete this.mesh;
    }
  }
  
  displayText(text) {
    if ( text ) {
      this.altText = text;
    }
    if ( this.mesh.material.diffuseTexture ) {
       this.mesh.material.diffuseTexture.dispose();
    }
    this.mesh.material.diffuseTexture = new BABYLON.DynamicTexture("WebCamTexture", {width:128, height:128}, this.scene);
    this.mesh.material.diffuseTexture.drawText(this.altText, null, null, this.textStyle, this.textColor, this.backColor, false, true);    
  }
  
  async displayVideo( deviceId ) {
    if ( deviceId ) {
      this.deviceId = deviceId;
    }
    if ( ! this.deviceId ) {
      var devices = await navigator.mediaDevices.enumerateDevices();
      for (var idx = 0; idx < devices.length; ++idx) {
        if (devices[idx].kind === "videoinput") {
          console.log(devices[idx]);
          this.deviceId = devices[idx].deviceId;
          break;
        }
      }
    }
    if ( this.deviceId ) {
      BABYLON.VideoTexture.CreateFromWebCamAsync(this.scene, { maxWidth: this.maxWidth, maxHeight: this.maxHeight, deviceId: this.deviceId }).then( (texture) => {
        if ( this.mesh.material.diffuseTexture ) {
           this.mesh.material.diffuseTexture.dispose();
        }
        this.mesh.material.diffuseTexture = texture;
        if ( this.callback ) {
          this.callback();
        }
      });
    }
  }
  
  displayStream( mediaStream ) {
    BABYLON.VideoTexture.CreateFromStreamAsync(this.scene, mediaStream).then( (texture) => {
      if ( this.mesh.material.diffuseTexture ) {
         this.mesh.material.diffuseTexture.dispose();
      }
      this.mesh.material.diffuseTexture = texture;
    });
  }
  
  attachToCamera( position ) {
    this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
    this.mesh.parent = this.camera;
    if ( position ) {
      this.mesh.position = position;
    } else {
      // 5cm below, 30 cm ahead of eyes
      this.mesh.position = new BABYLON.Vector3( 0, -.05, .3 );
      var scale = (this.radius/2)/20; // 5cm size
      this.mesh.scaling = new BABYLON.Vector3(scale, scale, scale);
    }
    this.cameraChanged();
    this.attached = true;
    this.scene.onActiveCameraChanged.add( this.cameraTracker );
  }
  
  detachFromCamera() {
    if ( this.attached ) {
      this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      this.mesh.position = this.camera.position; // CHECKME: must be the same
      console.log("Mesh position: "+this.mesh.position);
      this.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
      this.scene.onActiveCameraChanged.remove( this.cameraTracker );
      this.mesh.parent = null;
      this.attached = false;
    }
  }
  
  cameraChanged() {
    if ( this.autoAttach ) {
      console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
      this.camera = this.scene.activeCamera;
      this.attached = true;
      this.mesh.parent = this.camera;
    }
  }
    
}