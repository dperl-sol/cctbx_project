'use strict';

// Microsoft Edge users follow instructions on
// https://stackoverflow.com/questions/31772564/websocket-to-localhost-not-working-on-microsoft-edge
// to enable websocket connection

//import THREE from './three.js';
//import NGL from './ngl.esm.js';
//var three = THREE;

if ((typeof isHKLviewer) != "boolean")
  var isHKLviewer = false;

var pagename = location.pathname.substring(1);

if ((typeof websocket_portnumber) != "number")
{
// get portnumber for websocket from the number embedded in the filename
// with a regular expression
  var websocket_portnumber = parseInt( pagename.match("hkl_([0-9]+).htm")[1] );
}

if ((typeof websocket_portnumber) != "number")
    alert("Specify port number for the websocket in your html file either like: \n \
<script> var websocket_portnumber = 42673; </script> \n \
or embedded in the filename such as:\n \
C:/Users/Oeffner/AppData/Local/Temp/hkl_42673.htm"
   );

var mysocket;
var socket_intentionally_closed = false;

var shape = new NGL.Shape('shape');
var stage = new NGL.Stage('viewport', {  backgroundColor: "rgb(128, 128, 128)",
                                    tooltip:false, // create our own tooltip from a div element
                                    fogNear: 100, fogFar: 100 });

var shapeComp = null;
var vectorshape = null;
var repr = null;
var AA = String.fromCharCode(197); // short for angstrom
var DGR = String.fromCharCode(176); // short for degree symbol
var current_ttip = "";
var ttips = [];
var vectorreprs = [];
var vectorshapeComps = [];
var positions = [];
var br_positions = [];
var br_colours = [];
var br_radii = [];
var br_ttips = [];
var colours = [];
var alphas = [];
var radii = [];
var shapebufs = [];
var br_shapebufs = [];
var nrots = 0;
var fontsize = 9;
var postrotmxflag = false;
var cvorient = new NGL.Matrix4();
var oldmsg = "";
var clipFixToCamPosZ = false;
var origclipnear;
var origclipfar;
var origcameraZpos;
var nbins = 0;
var rerendered = false;
var expstate = "";
var current_ttip_ids;
var isdebug = false;
var tdelay = 100;
var displaytooltips = true;
var colourchart = null;
var infobanner = null;
var ResetViewBtn = null;
var sockwaitcount = 0;
var ready_for_closing = false;
var columnSelect = null;
var animationspeed = -1.0;
var XYZaxes = null;
var Hstarstart = null;
var Hstarend = null;
var Kstarstart = null;
var Kstarend = null;
var Lstarstart = null;
var Lstarend = null;
var Hlabelpos = null;
var Klabelpos = null;
var Llabelpos = null;
var Hlabelvec = new NGL.Vector3();
var Klabelvec = new NGL.Vector3();
var Llabelvec = new NGL.Vector3();
var annodivs = [];
var div_annotation_opacity = 0.7;
var camtype = "orthographic";
//var negativeradiistr;


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function createElement(name, properties, style, fsize=10)
{
// utility function used in for loop over colourgradvalarray
  let el = document.createElement(name);
  Object.assign(el, properties);
  Object.assign(el.style, style);
  Object.assign(el.style,
  {
    display: "block",
    position: "absolute",
    fontFamily: "sans-serif",
    fontSize: fsize.toString() + "pt",
  }
  );
  return el;
}


function createSelect(options, properties, style)
{
  let select = createElement("select", properties, style);
  options.forEach(function (d)
  {
    select.add(createElement("option", { value: d[0], text: d[1] }));
  })
  return select;
}


function addElement(el)
{
// utility function used in for loop over colourgradvalarray
  Object.assign(el.style,
  {
    position: "absolute",
    zIndex: 10
  }
  );
  stage.viewer.container.appendChild(el);
}


function addDivBox(name, t, l, w, h, bgcolour = "rgba(255, 255, 255, 0.0)", fsize = 10) {
  let txt = "";
  if (name != null && name != "null")
    txt = name.toString();
  else
    txt = "";

  let divbox = createElement("div",
    {
      innerText: txt
    },
    {
      backgroundColor: bgcolour,
      color: "rgba(0, 0, 0, 1.0)",
      top: t.toString() + "px",
      left: l.toString() + "px",
      width: w.toString() + "px",
      height: h.toString() + "px",
    },
    fsize
  );
  addElement(divbox);
  return divbox;
}


function addBottomDivBox(name, b, l, w, h, bgcolour = "rgba(255, 255, 255, 0.0)", fsize = 10) {
  let txt = "";
  if (name != null && name != "null")
    txt = name.toString();
  else
    txt = "";

  let divbox = createElement("div",
    {
      innerText: txt
    },
    {
      backgroundColor: bgcolour,
      color: "rgba(0, 0, 0, 1.0)",
      bottom: b.toString() + "px",
      left: l.toString() + "px",
      width: w.toString() + "px",
      height: h.toString() + "px",
    },
    fsize
  );
  addElement(divbox);
  return divbox;
}


function addDiv2Container(container, name, t, l, w, h, bgcolour="rgba(255, 255, 255, 0.0)", fsize=10)
{
  let divbox = addDivBox(name, t, l, w, h, bgcolour, fsize)
  container.append( divbox );
}


function createDivElement(label, rgb)
{
  let elm = createElement("div", { innerText: label },
    {
      color: "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", 1.0)",
      backgroundColor: "rgba(255, 255, 255, " + div_annotation_opacity + ")",
      padding: "4px"
    }, fontsize
  );
  
  let pointelm = createElement("pointdiv", // make a small white square to indicate where this elm is pointing
    {  innerText: ""  },
    {
      backgroundColor: "rgba(255, 255, 255, 0.0)",
      color: "rgba(255, 255, 255, 1.0)",
      top: "0px",
      left: "0px",
      width: "2px",
      height: "2px",
    },
    fontsize
  );
  
  elm.append(pointelm);
  return elm;
}




function CreateWebSocket()
{
  try
  {
    mysocket = new WebSocket('ws://localhost:' + websocket_portnumber);
    //mysocket = new WebSocket('wss://localhost:' + websocket_portnumber);
    mysocket.bufferType = "arraybuffer"; // "blob";
    //if (mysocket.readyState !== mysocket.OPEN)
    //  alert('Cannot connect to websocket server! \nAre the firewall permissions or browser security too strict?');
    //  socket_intentionally_closed = false;
    mysocket.onerror = function(e) { onError(e)  };
    mysocket.onopen = function(e) { onOpen(e)  };
    mysocket.onclose = function(e) { onClose(e)  };
    mysocket.onmessage = function(e) { onMessage(e)  };

  }
  catch(err)
  {
    alert('JavaScriptError: ' + err.stack );
    //addDivBox("Error!", window.innerHeight - 50, 20, 40, 20, "rgba(100, 100, 100, 0.0)");
  }
}

CreateWebSocket();


function RemoveStageObjects()
{
  // delete the shapebufs[] that holds the positions[] arrays
  if (shapeComp != null)
  {
    shapeComp.removeRepresentation(repr);
    // remove shapecomp from stage first
    stage.removeAllComponents();
  }
  if (colourchart != null) {
    colourchart.remove(); // delete previous colour chart if any
    colourchart = null;
  }
  ttips = [];
  vectorreprs = [];
  vectorshapeComps = [];
  positions = [];
  br_positions = [];
  br_colours = [];
  br_radii = [];
  br_ttips = [];
  expstate = "";
  colours = [];
  alphas = [];
  radii = [];
  shapebufs = [];
  br_shapebufs = [];
  shapeComp = null;
  // delete shape to ensure shape.boundingbox will equal viewer.boundingbox of the currently loaded reflections
  shape = null;
  vectorshape = null;
  repr = null;
  nbins = 0;
}


function WebsockSendMsg(msg, message_is_complete = true)
{
  try
  {
    if (socket_intentionally_closed == true)
      return;
    // Avoid "WebSocket is already in CLOSING or CLOSED state" errors when using QWebEngineView
    // See https://stackoverflow.com/questions/48472977/how-to-catch-and-deal-with-websocket-is-already-in-closing-or-closed-state-in

    if (mysocket.readyState === mysocket.CONNECTING )
    {
      sleep(50).then(()=> {
         WebsockSendMsg(msg);
          return;
        }
      );
    }

    if (mysocket.readyState === mysocket.OPEN)
    {
      mysocket.send(msg);
      if (message_is_complete == true)
        mysocket.send( 'Ready ' + pagename + '\n' );
    }
    else
      if (mysocket.readyState !== mysocket.CONNECTING)
      {
        sleep(200).then(()=> {
            if (mysocket.readyState !== mysocket.OPEN )
            {
              mysocket.close(4242, 'Refreshing ' + pagename); // not sure this is ever received by server
              CreateWebSocket();
              WebsockSendMsg('Connection lost and reestablished')
              WebsockSendMsg(msg);
            }
            return;
          }
        );
        //alert('Cannot send data! \nAre the firewall permissions or browser security too strict?');
      }
  }
  catch(err)
  {
    alert('JavaScriptError: ' + err.stack );
    addDivBox("Error!", window.innerHeight - 50, 20, 40, 20, "rgba(100, 100, 100, 0.0)");
  }
}


var dbgmsg = "";
// debug message window
var debugmessage = document.createElement("div");
Object.assign(debugmessage.style, {
  position: "absolute",
  zIndex: 10,
  pointerEvents: "none",
  backgroundColor: "rgba(255, 255, 255, 0.8 )",
  color: "black",
  padding: "0.1em",
  fontFamily: "sans-serif",
  bottom: "10px",
  left: "10px",
  fontSize: "smaller",
  display: "block"
});


function ReturnClipPlaneDistances()
{
  let cameradist;
  if (stage.viewer.parameters.clipScale == 'relative')
    cameradist = stage.viewer.cDist;
  if (stage.viewer.parameters.clipScale == 'absolute')
    if (stage.viewer.cDist != 0
         && stage.viewer.parameters.clipFar > stage.viewer.cDist
         && stage.viewer.cDist > stage.viewer.parameters.clipNear)
      cameradist = stage.viewer.cDist;
    else if (stage.viewer.camera.position.z != 0
         && stage.viewer.parameters.clipFar > -stage.viewer.camera.position.z
         && -stage.viewer.camera.position.z > stage.viewer.parameters.clipNear)
      cameradist = stage.viewer.camera.position.z;
    else if (stage.viewer.camera.position.z == -stage.viewer.cDist)
      cameradist = stage.viewer.cDist;
    else
      return;

  let msg = String( [stage.viewer.parameters.clipNear,
                  stage.viewer.parameters.clipFar,
                  cameradist ] )
  WebsockSendMsg('ReturnClipPlaneDistances:\n' + msg );
}


function DeletePrimitives(reprname)
{
  let thisrepr = stage.getRepresentationsByName(reprname);
  let wasremoved = false;
  for (let i = 0; i < stage.compList.length; i++)
    if (stage.compList[i].reprList.length > 0 && stage.compList[i].reprList[0].name == reprname) {
      let thiscomp = stage.compList[i];
      thiscomp.removeRepresentation(thisrepr);
      stage.removeComponent(thiscomp);
      wasremoved = true;
    }
  return wasremoved;
};

function RemovePrimitives(reprname)
{
  // if reprname is supplied only remove vectors with that name
  let reprnamegone = false;
  let clipvecgone = false;
  let unitcellgone = false;
  let reciprocunitcellgone = false;
  if (reprname != "")
    reprnamegone = DeletePrimitives(reprname);
  else // otherwise remove all vectors
  {
    clipvecgone = DeletePrimitives("clip_vector");
    unitcellgone = DeletePrimitives("unitcell");
    reciprocunitcellgone = DeletePrimitives("reciprocal_unitcell");
  }
  if (reprnamegone || clipvecgone || unitcellgone || reciprocunitcellgone)
    RenderRequest();
}



async function RenderRequest()
{
  await sleep(100);
  stage.viewer.requestRender();
  if (isdebug)
    WebsockSendMsg( 'RenderRequest ' + pagename );
}

// Log errors to debugger of your browser
function onError(e)
{
  let msg = 'WebSocket Error ' + e;
  console.log(msg);
  dbgmsg =msg;
};


function onOpen(e)
{
  let msg = 'Now connected via websocket to ' + pagename + '\n';
  WebsockSendMsg(msg);
  dbgmsg =msg;
  rerendered = false;
};


function onClose(e)
{
  let msg = 'Now disconnecting from websocket ' + pagename + '\n';
  console.log(msg);
  dbgmsg =msg;
};


function onMessage(e)
{
  let c,
    si;
  let showdata = e.data;
  if (showdata.length > 400)
    showdata = e.data.slice(0, 200) + '\n...\n' + e.data.slice(e.data.length - 200, -1);
  if (isdebug)
    WebsockSendMsg('Browser: Got ' + showdata ); // tell server what it sent us
  try
  {
    let datval = e.data.split(":\n");
    let msgtype = datval[0];
    let val = datval[1].split(","); // assuming no commas in the received strings
    let val2 = datval[1].split(";;"); // in case the received strings contain intended commas

    if (msgtype === "Reload")
    {
    // refresh browser with the javascript file
      if (stage != null)
      {
        let msg = getOrientMsg();
        WebsockSendMsg('OrientationBeforeReload:\n' + msg );
      }
      WebsockSendMsg( 'Refreshing ' + pagename );

      sleep(200).then(()=> {
          socket_intentionally_closed = true;
          mysocket.close(4242, 'Refreshing ' + pagename);
          ready_for_closing = true;
          window.location.reload(true);
          // In 200ms we are gone. A new javascript file will be loaded in the browser
        }
      );
    }

    if (stage == null) // everything below assumes stage!=null
      return;

    if (msgtype === "alpha")
    {
      let bin = parseInt(val[0]);
      if (bin < shapebufs.length)
      {
        alphas[bin] = parseFloat(val[1]);
        shapebufs[bin].setParameters({ opacity: alphas[bin] });
        if (br_shapebufs.length)
          for (let g=0; g < nrots; g++ )
            br_shapebufs[bin][g].setParameters({opacity: alphas[bin]});
        RenderRequest();
      }
    }

    if (msgtype === "colour")
    {
      let bin = parseInt(val[0]);
      if (bin < shapebufs.length)
      {
        let si =  parseInt(val[1]);
        colours[bin][3*si] = parseFloat(val[2]);
        colours[bin][3*si+1] = parseFloat(val[3]);
        colours[bin][3*si+2] = parseFloat(val[4]);
        shapebufs[bin].setAttributes({ color: colours[bin] });

        if (br_shapebufs.length)
          for (let g=0; g < nrots; g++ )
          {
            br_colours[bin][3*si] = parseFloat(val[2]);
            br_colours[bin][3*si+1] = parseFloat(val[3]);
            br_colours[bin][3*si+2] = parseFloat(val[4]);
            br_shapebufs[bin][g].setAttributes({ color: br_colours[bin] });
          }
        RenderRequest();
      }
    }

    if (msgtype === "DisplayTooltips")
    {
      let displaytooltips = val[0];
      stage.signals.hovered.removeAll();
      if (displaytooltips == "hover")
        stage.signals.hovered.add( HoverPickingProxyfunc );
    }

    if (msgtype === "ShowThisTooltip")
    {
      current_ttip = eval(datval[1]).split("\n\n")[0];
      current_ttip_ids = eval(datval[1]).split("\n\n")[1];
    }

    if (msgtype === "TooltipOpacity")
    {
      div_annotation_opacity = val[0];
      Object.assign(tooltip.style, {
        backgroundColor: "rgba(255, 255, 255, " + val[0] + " )",
      });
    }

    if (msgtype === "Redraw")
    {
      RenderRequest();
      WebsockSendMsg( 'Redrawing ' + pagename );
    }

    if (msgtype === "ReOrient")
    {
      WebsockSendMsg( 'Reorienting ' + pagename );
      let sm = new Float32Array(16);
      for (let j=0; j<16; j++)
      {
        sm[j] = parseFloat(val[j]);
        if (isNaN( sm[j] ))
          return; // do nothing just in case
      }

      let m = new NGL.Matrix4();
      m.fromArray(sm);
      stage.viewerControls.orient(m);
      //stage.viewer.renderer.setClearColor( 0xffffff, 0.01);
      //stage.viewer.requestRender();
      RenderRequest();
      let msg = getOrientMsg();
      WebsockSendMsg('CurrentViewOrientation:\n' + msg );
    }

    if (msgtype.includes("Expand") && shapeComp != null)
    {
      if (msgtype == "Expand" && expstate == "")
        return;

      if (msgtype == "ExpandP1" && expstate == "isP1Expanded")
        return;

      if (msgtype == "ExpandFriedel" && expstate == "isFriedelExpanded")
        return;

      if (msgtype == "ExpandP1Friedel" && expstate == "isP1FriedelExpanded")
        return;

      WebsockSendMsg('Expanding data...');
      // delete the shapebufs[] that holds the positions[] arrays
      shapeComp.removeRepresentation(repr);
      // remove shapecomp from stage first
      stage.removeComponent(shapeComp);

      br_positions = [];
      br_colours = [];
      br_radii = [];
      br_ttips = [];
      br_shapebufs = [];
      let nexpandrefls = 0;

      //alert('rotations:\n' + val);
      // Rotation matrices for the spacegroup come as a string of floats
      // separated by line breaks between each roation matrix
      let rotationstrs = datval[1].split("\n");
      let Rotmats = [];
      let r = new NGL.Vector3();

      for (let rotmxidx=0; rotmxidx < rotationstrs.length; rotmxidx++ )
      {
        Rotmats.push( new NGL.Matrix3() );
        // convert string of rotation matrix elements into a Matrix3
        let elmstrs = rotationstrs[rotmxidx].split(",");
        for (let j=0; j<9; j++)
          Rotmats[rotmxidx].elements[j] = parseFloat(elmstrs[j]);
      }

      let Imx = new NGL.Matrix3();
      Imx.identity(); // for testing
      if ( !(msgtype.includes("P1")) && rotationstrs.length == 1 && Rotmats[0].equals(Imx) )
        throw "Only the identity matrix is provided. That means no P1 expansion of reflections!";

      for (let bin=0; bin<nbins; bin++)
      {
        let nsize = positions[bin].length/3; // number of reflections in each bin
        let csize = nsize*3;
        let nsize3 = nsize*3;
        let anoexp = false;

        if (msgtype.includes("Friedel") )
        {
          anoexp = true;
          csize = nsize*6;
        }
        br_positions.push( [] );
        br_shapebufs.push( [] );
        br_colours.push( [] );
        br_radii.push( [] );
        br_ttips.push( [] );

        br_colours[bin] = colours[bin];
        br_radii[bin] = radii[bin];
        if (anoexp)
        {
          let colarr = [];
          let cl = colours[bin].length;
          for (let i=0; i<cl; i++)
          {
            colarr[i] = colours[bin][i];
            colarr[i+cl] = colours[bin][i];
          }
          br_colours[bin] = new Float32Array(colarr);

          let radiiarr = [];
          let rl = radii[bin].length;
          for (let i=0; i<rl; i++)
          {
            radiiarr[i] = radii[bin][i];
            radiiarr[i+rl] = radii[bin][i];
          }
          br_radii[bin] = new Float32Array(radiiarr);
        }

        nrots = 0;
        nexpandrefls = 0;
        for (let rotmxidx=0; rotmxidx < rotationstrs.length; rotmxidx++ )
        {
          if (rotationstrs[rotmxidx].length < 1 )
            continue;
          nrots++;

          br_positions[bin].push( [] );
          br_shapebufs[bin].push( [] );
          br_ttips[bin].push( [] );
          Object.assign(br_ttips[bin][rotmxidx], ttips[bin]); // deep copy the ttips[bin] object
          br_ttips[bin][rotmxidx].ids = ttips[bin].ids.slice(0); // deep copy the ttips[bin].ids object
          br_ttips[bin][rotmxidx].ids[0] = rotmxidx; // id number of rotation. Used by PickingProxyfunc
          br_ttips[bin][rotmxidx].cartpos = ttips[bin].cartpos.slice(0); // deep copy the ttips[bin].cartpos object
          br_positions[bin][rotmxidx] = new Float32Array( csize );
          nexpandrefls += csize;

          for (let i=0; i<nsize; i++)
          {
            let idx= i*3;
            r.x = positions[bin][idx];
            r.y = positions[bin][idx+1];
            r.z = positions[bin][idx+2];

            r.applyMatrix3(Rotmats[rotmxidx]);

            br_positions[bin][rotmxidx][idx] = r.x;
            br_positions[bin][rotmxidx][idx + 1] = r.y;
            br_positions[bin][rotmxidx][idx + 2] = r.z;

            br_ttips[bin][rotmxidx].cartpos[i] = [r.x,r.y,r.z];

            if (anoexp)
            {
              r.negate(); // inversion for anomalous pair
              br_positions[bin][rotmxidx][nsize3 + idx] = r.x;
              br_positions[bin][rotmxidx][nsize3 + idx + 1] = r.y;
              br_positions[bin][rotmxidx][nsize3 + idx + 2] = r.z;
              br_ttips[bin][rotmxidx].cartpos[nsize + i] = [r.x, r.y, r.z];
            }
          }

          br_shapebufs[bin][rotmxidx] = new NGL.SphereBuffer({
              position: br_positions[bin][rotmxidx],
              color: br_colours[bin],
              radius: br_radii[bin],
              // rotmxidx works as the id of the rotation of applied symmetry operator when creating tooltip for an hkl
              picking: br_ttips[bin][rotmxidx],
              } );
          shape.addBuffer(br_shapebufs[bin][rotmxidx]);
        }
        if (nexpandrefls == nsize*3)
          expstate = "";
        if (nexpandrefls == nsize*6)
          expstate = "isFriedelExpanded";
        if (nexpandrefls == nsize*3*nrots && nrots > 1)
          expstate = "isP1Expanded";
        if (nexpandrefls == nsize*6*nrots && nrots > 1)
          expstate = "isP1FriedelExpanded";
      }
      shapeComp = stage.addComponentFromObject(shape);
      MakeHKL_Axis();
      repr = shapeComp.addRepresentation('buffer');

      for (let bin=0; bin<nbins; bin++)
      {
        for (let rotmxidx=0; rotmxidx < nrots; rotmxidx++ )
        {
          br_shapebufs[bin][rotmxidx].setParameters({opacity: alphas[bin]});
        }
      }

      RenderRequest();
      WebsockSendMsg( 'Done ' + msgtype );
    }

    if (msgtype === "DisableMouseRotation")
    {
      WebsockSendMsg( 'Fix mouse rotation' + pagename );
      stage.mouseControls.remove("drag-left");
      stage.mouseControls.remove("scroll-ctrl");
      stage.mouseControls.remove("scroll-shift");
    }

    if (msgtype === "EnableMouseRotation")
    {
      WebsockSendMsg( 'Can mouse rotate ' + pagename );
      stage.mouseControls.add("drag-left", NGL.MouseActions.rotateDrag);
      stage.mouseControls.add("scroll-ctrl", NGL.MouseActions.scrollCtrl);
      stage.mouseControls.add("scroll-shift", NGL.MouseActions.scrollShift);
    }

    if (msgtype === "RotateStage")
    {
      WebsockSendMsg('Rotating stage ' + pagename);

      let sm = new Float32Array(9);
      let m4 = new NGL.Matrix4();

      for (let j = 0; j < 9; j++)
        sm[j] = parseFloat(val[j]);

      // GL matrices are the transpose of conventional rotation matrices
      m4.set(sm[0], sm[3], sm[6], 0.0,
        sm[1], sm[4], sm[7], 0.0,
        sm[2], sm[5], sm[8], 0.0,
        0.0, 0.0, 0.0, 1.0
      );
      stage.viewerControls.orient(m4);
      if (val[9] == "verbose")
        postrotmxflag = true;
      ReturnClipPlaneDistances();
      RenderRequest();
      sleep(100).then(() => {
        let msg = getOrientMsg();
        WebsockSendMsg('CurrentViewOrientation:\n' + msg);
      }
      );
    }

    if (msgtype === "RotateAxisStage")
    {
      WebsockSendMsg('Rotating stage around axis' + pagename);

      let sm = new Float32Array(9);
      let m4 = new NGL.Matrix4();
      let axis = new NGL.Vector3();
      let theta = parseFloat(val[3]);
      axis.x = parseFloat(val[0]);
      axis.y = parseFloat(val[1]);
      axis.z = parseFloat(val[2]);
      m4.makeRotationAxis(axis, theta);
      stage.viewerControls.applyMatrix(m4);
      if (val[4] == "verbose")
        postrotmxflag = true;
      ReturnClipPlaneDistances();
      RenderRequest();
      sleep(100).then(() => {
        let msg = getOrientMsg();
        WebsockSendMsg('CurrentViewOrientation:\n' + msg);
      }
      );
    }

    if (msgtype === "RotateComponents" && shapeComp != null)
    {
      WebsockSendMsg('Rotating components ' + pagename);

      let sm = new Float32Array(9);
      let m4 = new NGL.Matrix4();
      stm4 = stage.viewerControls.getOrientation().elements;

      for (let j = 0; j < 9; j++)
        sm[j] = parseFloat(val[j]);

      // GL matrices are the transpose of conventional rotation matrices
      m4.set(sm[0], sm[3], sm[6], stm4[3],
        sm[1], sm[4], sm[7], stm4[7],
        sm[2], sm[5], sm[8], stm4[11],

        stm4[12], stm4[13], stm4[14], stm4[15]
      );
      shapeComp.setTransform(m4);
      if (val[9] == "verbose")
        postrotmxflag = true;
      RenderRequest();
      sleep(100).then(() => {
        let msg = String(shapeComp.matrix.elements);
        WebsockSendMsg('CurrentComponentRotation:\n' + msg);
      }
      );
    }

    if (msgtype === "RotateAxisComponents" && shapeComp != null) {
      WebsockSendMsg('Rotating components around axis ' + pagename);
      let sm = new Float32Array(9);
      let m4 = new NGL.Matrix4();
      let axis = new NGL.Vector3();
      let theta = parseFloat(val[3]);
      axis.x = parseFloat(val[0]);
      axis.y = parseFloat(val[1]);
      axis.z = parseFloat(val[2]);
      m4.makeRotationAxis(axis, theta);

      shapeComp.setTransform(m4);
      for (let i = 0; i < vectorshapeComps.length; i++) {
        if (typeof vectorshapeComps[i].reprList != "undefined")
          vectorshapeComps[i].setTransform(m4);
      }

      if (val[4] == "verbose")
        postrotmxflag = true;
      RenderRequest();
      sleep(100).then(() => {
        let msg = String(shapeComp.matrix.elements);
        WebsockSendMsg('CurrentComponentRotation:\n' + msg);
      }
      );
    }

    if (msgtype === "AnimateRotateAxisComponents" && shapeComp != null) {
      WebsockSendMsg('Animate rotating components around axis ' + pagename);
      let sm = new Float32Array(9);
      let m4 = new NGL.Matrix4();
      let axis = new NGL.Vector3();
      animationspeed = parseFloat(val[3])*0.05;
      axis.x = parseFloat(val[0]);
      axis.y = parseFloat(val[1]);
      axis.z = parseFloat(val[2]);

      let then = 0;
      let theta = 0.0;
      function render(now)
      { // as in https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Animating_objects_with_WebGL
        now *= 0.001;
        const deltaTime = now - then;
        then = now;

        if (animationspeed > 0)
          theta = (theta + deltaTime * animationspeed) % 360;
        else
          theta = 0.0;

        m4.makeRotationAxis(axis, theta);
        shapeComp.setTransform(m4);
        for (let i = 0; i < vectorshapeComps.length; i++) {
          if (typeof vectorshapeComps[i].reprList != "undefined")
            vectorshapeComps[i].setTransform(m4);
        }
        stage.viewer.requestRender();

        if (animationspeed > 0)
          requestAnimationFrame(render);
      }
      if (animationspeed > 0)
        requestAnimationFrame(render);

      sleep(100).then(() => {
        let msg = String(shapeComp.matrix.elements);
        WebsockSendMsg('CurrentComponentRotation:\n' + msg);
      }
      );
    }

    if (msgtype === "TranslateHKLpoints" && shapeComp != null)
    {
      WebsockSendMsg( 'Translating HKLs ' + pagename );
      let strs = datval[1].split("\n");
      let sm = new Float32Array(3);
      let elmstrs = strs[0].split(",");
      for (let j=0; j<3; j++)
        sm[j] = parseFloat(elmstrs[j]);
      shapeComp.setPosition([ sm[0], sm[1], sm[2] ]);
      RenderRequest();
      sleep(100).then(()=> {
          let msg = getOrientMsg();
          WebsockSendMsg('CurrentViewOrientation:\n' + msg );
        }
      );
    }

    if (msgtype === "DrawSphere") {
      let pos = new Float32Array(3);
      let rgb = new Float32Array(3);
      for (let j = 0; j < 3; j++) {
        pos[j] = parseFloat(val2[j]);
        rgb[j] = parseFloat(val2[j + 3]);
      }
      let radius = parseFloat(val2[6]);
      let iswireframe = parseInt(val2[8]);

      if (vectorshape == null)
      {
        if (iswireframe == 1)
          vectorshape = new NGL.Shape('vectorshape', { disableImpostor: true });
        else
          vectorshape = new NGL.Shape('vectorshape');
      }

      vectorshape.addSphere(pos, rgb, radius);
      // if reprname is supplied then make a representation named reprname
      // of this and all pending spheres stored in vectorshape and render them.
      // Otherwise just accummulate the new sphere
      let reprname = val2[7].trim();
      if (reprname != "") {
        DeletePrimitives(reprname); // delete any existing vectors with the same name
        vectorshapeComps.push(stage.addComponentFromObject(vectorshape));
        if (iswireframe == 1)
          vectorreprs.push(
            vectorshapeComps[vectorshapeComps.length - 1].addRepresentation('vecbuf',
              { name: reprname, wireframe: true })
          )
        else
          vectorreprs.push(
            vectorshapeComps[vectorshapeComps.length - 1].addRepresentation('vecbuf',
              { name: reprname })
          )
        vectorshapeComps[vectorshapeComps.length - 1].autoView(500) // half a second animation
        vectorshape = null;
        RenderRequest();
      }
    }

    if (msgtype === "DrawVector")
    {
      let r1 = new Float32Array(3);
      let r2 = new Float32Array(3);
      let rgb = new Float32Array(3);
      for (let j=0; j<3; j++)
      {
        r1[j] = parseFloat(val2[j]);
        r2[j] = parseFloat(val2[j+3]);
        rgb[j]= parseFloat(val2[j+6]);
      }
      let radius = parseFloat(val2[11]);

      if (vectorshape == null)
        vectorshape = new NGL.Shape('vectorshape');

      vectorshape.addArrow(r1, r2, [rgb[0], rgb[1], rgb[2]], radius);
      let label = val2[9].trim();
      if (label !== "")
      {
        let labelpos = parseFloat(val2[12]);
        let pos = new NGL.Vector3()
        let txtR = [
          r1[0] * (1.0 - labelpos) + r2[0] * labelpos,
          r1[1] * (1.0 - labelpos) + r2[1] * labelpos,
          r1[2] * (1.0 - labelpos) + r2[2] * labelpos
        ];
        pos.x = txtR[0];
        pos.y = txtR[1];
        pos.z = txtR[2];

        let elm = createDivElement(label, rgb)
        annodivs.push([elm, pos]);  // store until we get a representation name
      }
      // if reprname is supplied with a vector then make a representation named reprname
      // of this and all pending vectors stored in vectorshape and render them.
      // Otherwise just accummulate the new vector
      let reprname = val2[10].trim();
      if (reprname != "")
      {
        DeletePrimitives(reprname); // delete any existing vectors with the same name
        let cmp = stage.addComponentFromObject(vectorshape);
        for (let i = 0; i < annodivs.length; i++)
        {
          let elm = annodivs[i][0];
          let pos = annodivs[i][1];
          cmp.addAnnotation(pos, elm);
        }
        vectorshapeComps.push(cmp);
        annodivs = [];
        vectorreprs.push(
          vectorshapeComps[vectorshapeComps.length-1].addRepresentation('vecbuf',
                                                                      { name: reprname} )
        );
        vectorshape = null;
        RenderRequest();
      }
    }

    if (msgtype === "RemovePrimitives")
    {
      RemovePrimitives(val[0].trim());
      /*
      let reprname = val[0].trim(); // elmstrs[0].trim();
      // if reprname is supplied only remove vectors with that name
      let reprnamegone = false;
      let clipvecgone = false;
      let unitcellgone = false;
      let reciprocunitcellgone = false;
      if (reprname != "")
        reprnamegone = DeletePrimitives(reprname);
      else // otherwise remove all vectors
      {
        clipvecgone = DeletePrimitives("clip_vector");
        unitcellgone = DeletePrimitives("unitcell");
        reciprocunitcellgone = DeletePrimitives("reciprocal_unitcell");
      }
      if (reprnamegone || clipvecgone || unitcellgone || reciprocunitcellgone)
        RenderRequest();
      */
    }

    if (msgtype === "DefineHKL_Axes")
    {
      let strarrs = datval[1].split("\n\n");
      let hstart = eval(strarrs[0]);
      let hend = eval(strarrs[1]);
      let kstart = eval(strarrs[2]);
      let kend = eval(strarrs[3]);
      let lstart = eval(strarrs[4]);
      let lend = eval(strarrs[5]);
      let hlabelpos = eval(strarrs[6]);
      let klabelpos = eval(strarrs[7]);
      let llabelpos = eval(strarrs[8]);

      DefineHKL_Axes(hstart, hend, kstart, kend, 
                 lstart, lend, hlabelpos, klabelpos, llabelpos)
    }

    if (msgtype === "SetFontSize")
    {
      fontsize = parseFloat(val[0]);
      RenderRequest();
    }

    if (msgtype === "SetMouseSpeed")
    {
      stage.trackballControls.rotateSpeed = parseFloat(val[0]);
    }

    if (msgtype === "SetCameraType")
    {
      camtype = val[0];
      stage.setParameters( { cameraType: camtype } );
      RenderRequest();
    }

    if (msgtype === "GetMouseSpeed")
    {
      msg = String( [stage.trackballControls.rotateSpeed] )
      WebsockSendMsg('ReturnMouseSpeed:\n' + msg );
    }

    if (msgtype === "SetClipPlaneDistances")
    {
      let near = parseFloat(val[0]);
      let far = parseFloat(val[1]);
      origcameraZpos = parseFloat(val[2]);
      stage.viewer.parameters.clipMode =  'camera';
      // clipScale = 'absolute' means clip planes are using scene dimensions
      stage.viewer.parameters.clipScale = 'absolute';
      clipFixToCamPosZ = true;

      if (near >= far )
      { // default to no clipping if near >= far
        stage.viewer.parameters.clipMode = 'scene';
      // clipScale = 'relative' means clip planes are in percentage
        stage.viewer.parameters.clipScale = 'relative';
        clipFixToCamPosZ = false;
        near = 0;
        far = 100;
      }
      else
        stage.viewer.camera.position.z = origcameraZpos;
      stage.viewer.parameters.clipNear = near;
      stage.viewer.parameters.clipFar = far;
      origclipnear = near;
      origclipfar = far;
      //stage.viewer.requestRender();
      RenderRequest();
    }

    if (msgtype === "GetClipPlaneDistances")
      ReturnClipPlaneDistances();

    if (msgtype === "GetBoundingBox")
    {
      let msg = String( [stage.viewer.boundingBoxSize.x,
                     stage.viewer.boundingBoxSize.y,
                     stage.viewer.boundingBoxSize.z]
                  )
      WebsockSendMsg('ReturnBoundingBox:\n' + msg );
    }

    if (msgtype ==="JavaScriptCleanUp")
    {
      RemoveStageObjects();
      stage.mouseObserver.dispose();
      stage.dispose();
      stage = null;
      ready_for_closing = true;
      WebsockSendMsg('JavaScriptCleanUpDone:\nDestroying JavaScript objects');
      socket_intentionally_closed = true;
      mysocket.close(4241, 'Cleanup done');
      document = null;
    }

    if (msgtype === "PrintInformation") {
      let msg = datval[1];
      let wp = getTextWidth(msg, fontsize);
      if (infobanner != null)
        infobanner.remove(); // delete previous colour chart if any
      if (msg == "")
        return;
      infobanner = addBottomDivBox(msg, 10, 110, wp+2, 15, "rgba(255, 255, 255, 1.0)", fontsize);
    }

    if (msgtype === "SetBrowserDebug") {
      isdebug = (val[0] === "true");
    }

    if (msgtype ==="RemoveStageObjects")
    {
      RemoveStageObjects();
    }

    if (msgtype === "AddSpheresBin2ShapeBuffer")
    {
      let strarrs = datval[1].split("\n\n");
      let coordarray = eval(strarrs[0]);
      let colourarray = eval(strarrs[1]);
      let radiiarray = eval(strarrs[2]);
      let ttipids = eval(strarrs[3]);
      AddSpheresBin2ShapeBuffer(coordarray, colourarray, radiiarray, ttipids);
    }

    if (msgtype === "MakeColourChart")
    {
      let msg = datval[1].split("\n\n");
      let ctop = eval(msg[0]);
      let cleft = eval(msg[1]);
      let label = msg[2];
      let fomlabel = msg[3];
      let colourgradvalarrays = eval(msg[4]);
      MakeColourChart(ctop, cleft, label, fomlabel, colourgradvalarrays);
      RenderRequest();
    }

    if (msgtype ==="RenderStageObjects")
    {
      shapeComp = stage.addComponentFromObject(shape);
      MakeHKL_Axis();
      MakeXYZ_Axis();
      repr = shapeComp.addRepresentation('buffer');
      RenderRequest();
      WebsockSendMsg('Drawing new reflections');
    }

    if (msgtype === "SetAutoView")
    {
      if (shapeComp != null) // workaround for QTWebEngine bug sometimes failing to render scene
        shapeComp.autoView(500); // half a second animation
      WebsockSendMsg('AutoViewSet ' + pagename);
    }

    if (msgtype === "MakeImage") {
      filename = val[0];
      stage.viewer.makeImage({ // using NGL's builtin function for making an image blob. html div legends are stripped
        factor: 1,
        antialias: true,
        trim: false,
        transparent: false
      }).then(function (blob) {
        if (parseInt(val[1]) < 3) {
          // Using websocket_server in python2 which doesn't allow streaming large compressed data
          // So use NGL's download image function
          NGL.download(blob, filename);
        }
        else { // websockets in python3 which supports streaming large blobs
          WebsockSendMsg('Imageblob', false);
          WebsockSendMsg(blob);
        }

        WebsockSendMsg('ImageWritten ' + pagename);
      });
    }

    if (msgtype === "MakeImage2") {
      filename = val[0];
      //CHROME ONLY
      // html2canvas retains div legends when creaing an image blob
      ResetViewBtn.style.display = "None"; // hide buttons and other GUL controls on this webpage
      html2canvas(document.getElementById("viewport")).then(function (canvas) {
        //blob = canvas.toDataURL("image/jpeg", 0.9);
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            if (parseInt(val[1]) < 3) {
              // Using websocket_server in python2 which doesn't allow streaming large compressed data
              // So use NGL's download image function
              NGL.download(blob, filename);
            }
            else { // websockets in python3 which supports streaming large blobs
              WebsockSendMsg('Imageblob', false);
              WebsockSendMsg(blob);
            }
          }, 'image/png')
        }
      });
      ResetViewBtn.style.display = "Block";
      WebsockSendMsg('ImageWritten ' + pagename);
    }

    if (msgtype === "MakeBrowserDataColumnComboBox")
    {
      if (columnSelect != null)
        columnSelect.remove(); 

      let msg = datval[1].split("\n\n");
      let columnSelect = createElement("select", {
        onchange: function (e)
        {
          WebsockSendMsg('SelectedBrowserDataColumnComboBox: ' + e.target.value);
        },
      }, { top: "25px", right: "10px", width: "130px", position: "absolute" }, fsize = fontsize);

      for (i = 0; i < msg.length - 1; i++) // last element is index of currently selected item
      {
        labelval = msg[i].split("\n");
        columnSelect.add(createElement("option", { text: labelval[0], value: labelval[1] }, fsize = fontsize));
      }
      addElement(columnSelect);
      columnSelect.options[ parseInt(msg[msg.length - 1]) ].selected = "true"; // display the selected element

      divlabel = createElement("div",
        {
          innerText: "Select Data"
        },
        {
          backgroundColor: "rgba(255, 255, 255, 1.0)",
          color: "rgba(0, 0, 0, 1.0)",
          top: "10px", right: "10px", width: "130px",
          position: "absolute"
        },
        fsize = fontsize
      );
      addElement(divlabel);

    }

    if (msgtype === "Testing")
    {
      // test something new
      /*
      var newradii = radii[0].map(function(element) {
        return element*1.5;
      });
      shapebufs[0].setAttributes({
          radius: newradii
      })
      repr = shapeComp.addRepresentation('buffer');
      //stage.viewer.requestRender();
      RenderRequest();
      */
    }
    if (isdebug)
    {
      WebsockSendMsg('Received message: ' + msgtype);
      debugmessage.innerText = dbgmsg;
    }
  }

  catch(err)
  {
    WebsockSendMsg('JavaScriptError: ' + err.stack );
  }

};



function timefunc() {
  let d = new Date();
  let now = d.getTime();
  return now
}

var timenow = timefunc();
var rightnow = timefunc();


window.addEventListener( 'resize',
  function( event )
  {
    stage.handleResize();
  },
  false
);


window.onbeforeunload = function(event) 
{
  if (!ready_for_closing)
    WebsockSendMsg('Warning!: Web browser closed unexpectedly perhaps by an external process. Call JavaScriptCleanUp() or Reload() instead.')
};


if (isdebug)
{
  let script=document.createElement('script');
  script.src='https://rawgit.com/paulirish/memory-stats.js/master/bookmarklet.js';
  document.head.appendChild(script);
}



// define tooltip element
var tooltip = document.createElement("div");
Object.assign(tooltip.style, {
  display: "none",
  position: "absolute",
  zIndex: 10,
  pointerEvents: "none",
  backgroundColor: "rgba(255, 255, 255, " + div_annotation_opacity + ")",
  color: "black",
  padding: "0.1em",
  fontFamily: "sans-serif"
});


function DefineHKL_Axes(hstart, hend, kstart, kend, 
                 lstart, lend, hlabelpos, klabelpos, llabelpos)
{
  Hstarstart = hstart;
  Hstarend = hend;
  Kstarstart = kstart;
  Kstarend = kend;
  Lstarstart = lstart;
  Lstarend = lend;
  Hlabelpos = hlabelpos;
  Klabelpos = klabelpos;
  Llabelpos = llabelpos;

  Hlabelvec.x = hlabelpos[0];
  Hlabelvec.y = hlabelpos[1];
  Hlabelvec.z = hlabelpos[2];
  Klabelvec.x = klabelpos[0];
  Klabelvec.y = klabelpos[1];
  Klabelvec.z = klabelpos[2];
  Llabelvec.x = llabelpos[0];
  Llabelvec.y = llabelpos[1];
  Llabelvec.z = llabelpos[2];
};


function MakeHKL_Axis()
{
  if (Hstarstart == null || Hstarend == null || Kstarstart == null || Kstarend == null
    || Lstarstart == null || Lstarend == null)
    return;
  //blue-x
  shape.addArrow( Hstarstart, Hstarend , [ 0, 0, 1 ], 0.1);
  //green-y
  shape.addArrow( Kstarstart, Kstarend, [ 0, 1, 0 ], 0.1);
  //red-z
  shape.addArrow( Lstarstart, Lstarend, [ 1, 0, 0 ], 0.1);

  let Helm = document.createElement("div");
  Helm.innerText = "h";
  Helm.style.color = "white";
  Helm.style.backgroundColor = "rgba(0, 0, 255, " + div_annotation_opacity + ")";
  Helm.style.fontSize = fontsize.toString() + "pt";
  Helm.style.padding = "4px"

  let Kelm = document.createElement("div");
  Kelm.innerText = "k";
  Kelm.style.color = "white";
  Kelm.style.backgroundColor = "rgba(0, 255, 0, " + div_annotation_opacity + ")";
  Kelm.style.fontSize = fontsize.toString() + "pt";
  Kelm.style.padding = "4px"

  let Lelm = document.createElement("div");
  Lelm.innerText = "l";
  Lelm.style.color = "white";
  Lelm.style.backgroundColor = "rgba(255, 0, 0, " + div_annotation_opacity + ")";
  Lelm.style.fontSize = fontsize.toString() + "pt";
  Lelm.style.padding = "4px"
  
  stage.compList[0].addAnnotation(Hlabelvec, Helm);
  stage.compList[0].addAnnotation(Klabelvec, Kelm);
  stage.compList[0].addAnnotation(Llabelvec, Lelm);
};


function getOrientMsg()
{
  let cvorientmx = null;
  cvorientmx = stage.viewerControls.getOrientation();
  if (cvorientmx == null || cvorientmx.determinant() == 0)
      return oldmsg; // don't return invalid matrix

  cvorient = cvorientmx.elements;
  for (let j=0; j<16; j++)
  {
    if (Number.isNaN( cvorient[j]) )
      return oldmsg; // don't return invalid matrix
  }
  let cameradist;
  if (stage.viewer.cDist != 0
        && stage.viewer.parameters.clipFar > stage.viewer.cDist
        && stage.viewer.cDist > stage.viewer.parameters.clipNear)
    cameradist = stage.viewer.cDist;
  else if (stage.viewer.camera.position.z != 0
        && stage.viewer.parameters.clipFar > -stage.viewer.camera.position.z
        && -stage.viewer.camera.position.z > stage.viewer.parameters.clipNear)
    cameradist = -stage.viewer.camera.position.z;
  else
    cameradist = cvorient[14]; // fall back if stage.viewer.camera.position.z is corrupted
  cvorient.push( cameradist );
  let msg = String(cvorient);
  oldmsg = msg;
  return msg;
}

// Distinguish between click and hover mouse events.
function HoverPickingProxyfunc(pickingProxy) {  PickingProxyfunc(pickingProxy, 'hover'); }
function ClickPickingProxyfunc(pickingProxy) { PickingProxyfunc(pickingProxy, 'click'); }

// listen to hover or click signal to show a tooltip at an hkl or to post hkl id for matching  entry in 
// millerarraytable in GUI or for visualising symmetry mates of the hkl for a given rotation operator
function PickingProxyfunc(pickingProxy, eventstr) {
  // adapted from http://nglviewer.org/ngl/api/manual/interaction-controls.html#clicked
  if (pickingProxy
    && (Object.prototype.toString.call(pickingProxy.picker["ids"]) === '[object Array]')
    && displaytooltips) {
    let cp = pickingProxy.canvasPosition;
    let sym_id = -1;
    let hkl_id = -1;
    let ids = [];
    let ttipid = "";
    let is_friedel_mate = 0;
    if (pickingProxy.picker["ids"].length > 0) { // get stored id number of rotation applied to this hkl
      sym_id = pickingProxy.picker["ids"][0]; // id of rotation stored when expanding to P1
      ids = pickingProxy.picker["ids"].slice(1); // ids of reflection
      hkl_id = ids[pickingProxy.pid % ids.length]; // id of reflection if it's not a friedel mate
      if (pickingProxy.pid >= ids.length)
        is_friedel_mate = 1;
    }
    // tell python the id of the hkl and id of the rotation operator
    rightnow = timefunc();
    if (rightnow - timenow > tdelay)
    { // only post every 50 milli second as not to overwhelm python
      ttipid = String([hkl_id, sym_id, is_friedel_mate]);
      // send this to python which will send back a tooltip text
      if (pickingProxy.mouse.buttons == 1 || eventstr == 'hover') // left click or hover for tooltips
        WebsockSendMsg(eventstr + '_tooltip_id: [' + ttipid + ']');
      if (pickingProxy.mouse.buttons == 2) // right click for matching hkls in table
        WebsockSendMsg('match_hkl_id: [' + ttipid + ']');
      timenow = timefunc();
    }

    if (isdebug)
      console.log("current_ttip_ids: " + String(current_ttip_ids) + ", ttipid: " + String(ttipid));
    if ((pickingProxy.mouse.buttons == 1 || eventstr == 'hover') // left click or hover
      && current_ttip !== ""
      && current_ttip_ids == ttipid) // received in onMessage() ShowThisTooltip
    {
      if (isdebug)
        if (is_friedel_mate == 1)
          tooltip.innerText = current_ttip + "\nx,y,z: " + String(pickingProxy.picker["cartpos"][hkl_id + ids.length]);
        else
          tooltip.innerText = current_ttip + "\nx,y,z: " + String(pickingProxy.picker["cartpos"][hkl_id]);
      else
        tooltip.innerText = current_ttip;
      tooltip.style.bottom = cp.y + 7 + "px";
      tooltip.style.left = cp.x + 8 + "px";
      tooltip.style.fontSize = fontsize.toString() + "pt";
      tooltip.style.display = "block";
    }
  }
  else {
    tooltip.style.display = "none";
    current_ttip = "";
  }
};


function getTextWidth(text, fsize=8)
{
  // re-use canvas object for better performance
  let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
  let context = canvas.getContext("2d");
  context.font = fsize.toString() + "pt sans-serif";
  let metrics = context.measureText(text);
  return metrics.width;
}


function MakeColourChart(ctop, cleft, millerlabel, fomlabel, colourgradvalarrays)
{
  /* colourgradvalarrays is a list of colour charts. If only one list then it's one colour chart.
  Otherwise it's usually a list of colour charts that constitute a gradient across colours,
  typically used for illustrating figure of merits attenuating phase values in map coefficients
  */
  let hfac = 60.0 / colourgradvalarrays[0].length;
  let ih = 3.0*hfac,
  topr = 25.0,
  topr2 = 0.0,
  lp = 2.0; // vertical margin between edge of white container and labels

  let maxnumberwidth = 0;
  for (let j = 0; j < colourgradvalarrays[0].length; j++)
  {
    let val = colourgradvalarrays[0][j][0];
    maxnumberwidth = Math.max( getTextWidth(val, fontsize), maxnumberwidth );
  }
  let wp = maxnumberwidth + 5,
  lp2 = lp + wp,
  gl = 2,
  wp2 = gl,
  fomlabelheight = 25;

  if (colourgradvalarrays.length === 1)
  {
    wp2 = 15;
    fomlabelheight = 0;
  }
  let wp3 = wp + colourgradvalarrays.length * wp2 + 2;
  let totalheight = ih * colourgradvalarrays[0].length + 35 + fomlabelheight;

  if (colourchart != null)
    colourchart.remove(); // delete previous colour chart if any
  colourchart = addDivBox(null, ctop, cleft, wp3, totalheight, "rgba(255, 255, 255, 1.0)");

  // make a white box on top of which boxes with transparent background are placed
  // containing the colour values at regular intervals as well as label legend of
  // the displayed miller array
  addDiv2Container(colourchart, null, topr2, lp, wp3, totalheight, 'rgba(255, 255, 255, 1.0)');

  // print label of the miller array used for colouring
  let lblwidth = getTextWidth(millerlabel, fontsize);
  addDiv2Container(colourchart, millerlabel, topr2, lp, lblwidth + 5, 20, 'rgba(255, 255, 255, 1.0)', fontsize);

  if (fomlabel != "" )
  {
    // print FOM label, 1, 0.5 and 0.0 values below colour chart
    let fomtop = topr2 + totalheight - 18;
    let fomlp = lp + wp;
    let fomwp = wp3;
    let fomtop2 = fomtop - 13;
    // print the 1 number
    addDiv2Container(colourchart, 1, fomtop2, fomlp, fomwp, 20, 'rgba(255, 255, 255, 0.0)', fontsize);
    // print the 0.5 number
    let leftp = fomlp + 0.48 * gl * colourgradvalarrays.length;
    addDiv2Container(colourchart, 0.5, fomtop2, leftp, fomwp, 20, 'rgba(255, 255, 255, 0.0)', fontsize);
    // print the FOM label
    addDiv2Container(colourchart, fomlabel, fomtop, fomlp, fomwp, 20, 'rgba(255, 255, 255, 0.0)', fontsize);
    // print the 0 number
    leftp = fomlp + 0.96 * gl * colourgradvalarrays.length;
    addDiv2Container(colourchart, 0, fomtop2, leftp, fomwp, 20, 'rgba(255, 255, 255, 0.0)', fontsize);
  }

  for (let j = 0; j < colourgradvalarrays[0].length; j++)
  {
    let val = colourgradvalarrays[0][j][0];
    let topv = j*ih + topr;
    let toptxt = topv - 5;
    // print value of miller array if present in colourgradvalarrays[0][j][0]
    addDiv2Container(colourchart,val, toptxt, lp, wp, ih, 'rgba(255, 255, 255, 0.0)', fontsize);
  }

  // if colourgradvalarrays is an array of arrays then draw each array next to the previous one
  for (let g = 0; g < colourgradvalarrays.length; g++)
  {
    let leftp = g*gl + lp + wp;
    for (let j = 0; j < colourgradvalarrays[g].length; j++)
    {
      let R = colourgradvalarrays[g][j][1];
      let G = colourgradvalarrays[g][j][2];
      let B = colourgradvalarrays[g][j][3];
      let rgbcol = 'rgba(' + R.toString() + ',' + G.toString() + ',' + B.toString() + ', 1.0)'
      let topv = j * ih + topr;
      // add an extra pixel to height to ensure no white lines accidentally emerge from roundoff errors
      addDiv2Container(colourchart, null, topv, leftp, wp2, ih + 1, rgbcol);
    }
  }


  colourchart.oncontextmenu = function (e) { // oncontextmenu captures right clicks
    e.preventDefault()
    //alert("in oncontextmenu")
    return false;
  };
  
  colourchart.onselectstart = function () { // don't select numbers or labels on chart when double clicking the coulour chart
    return false;
  }

  if (isHKLviewer == true)
    colourchart.style.cursor = "pointer";

  colourchart.onclick = function (e) {
    let sel = window.getSelection();
    sel.removeAllRanges(); // don't select numbers or labels on chart when double clicking the coulour chart
    if (isHKLviewer == true)
      WebsockSendMsg('onClick colour chart');
  };

}


function AddSpheresBin2ShapeBuffer(coordarray, colourarray, radiiarray, ttipids) 
{
  // Tooltip ids is a list of numbers matching the array index of the radiiarray 
  let ttiplst = [-1].concat(ttipids);
  // Prepend this list with -1. This value will be reassigned with an id nummber of 
  // a rotation operator when expanding to P1. PickingProxyfunc() will send back to cctbx.python the 
  // id number of the rotation operator and number in ttiplst matching the reflection that was clicked.
  let posarray = new Array(radiiarray.length);
  for (let i = 0; i < posarray.length; i++)
    posarray[i] = coordarray.slice(3 * i, 3 * i + 3);

  ttips.push( { ids: ttiplst, cartpos: posarray,
       getPosition: function() { return { x:0, y:0 }; } // dummy function to avoid crash
  }  );
  positions.push( new Float32Array( coordarray ) );
  colours.push( new Float32Array( colourarray ) );
  radii.push( new Float32Array( radiiarray ) );
  let curridx = positions.length -1;
  shapebufs.push( new NGL.SphereBuffer({
    position: positions[curridx], // 1dim array [x0, y0, z0, x1, y1, z1,...] for all reflections
    color: colours[curridx], // 1dim array [R0, G0, B0, R1, G1, B1,...] for all reflections
    radius: radii[curridx], // 1dim array [r0, r1, r3,...]for all reflections
    picking: ttips[curridx],
    })
  );
  if (shape == null)
    shape = new NGL.Shape('shape');
  shape.addBuffer(shapebufs[curridx]);
  //shapeComp = stage.addComponentFromObject(shape);
  //shapeComp.addRepresentation('buffer');
  alphas.push(1.0);
  nbins = nbins + 1;
}



function MakeXYZ_Axis() {
  // draw x and y arrows
  let linelength = 20;
  let linestart = 5;
  let vleft = 2;
  let hbottom = 2;
  let arrowhalfwidth = 2;
  let linewidth = 1;
  let arrowlength = 7;
  let labelfromarrow = linelength + linestart + arrowlength + 1;
  let labelwidth = getTextWidth("x", fontsize)

  if (XYZaxes != null)
    XYZaxes.remove(); // delete previous colour chart if any
  XYZaxes = addDivBox(null, 0, 10, 60, 60, "rgba(255, 255, 255, 0.0)");
  XYZaxes.style.top = ""; // offset from the bottom so leave top distance void
  XYZaxes.style.bottom = "30px";

  let velm = createElement("div", { innerText: "" },
    {
      backgroundColor: "rgba(0, 255, 0, 1.0)", color: "rgba(0, 0, 0, 0.0)",
      bottom: linestart.toString() + "px",
      height: linelength.toString() + "px",
      left: (vleft + arrowhalfwidth - linewidth / 2.0).toString() + "px",
      width: linewidth.toString() + "px",
      position: "absolute"
    }, 10);
  addElement(velm);
  XYZaxes.append(velm);

  let uparrow = createElement("div", { innerText: "" }, {
    backgroundColor: "rgba(0, 0, 255, 0.0)", color: "rgba(0, 0, 0, 0.0)",
    bottom: (linelength + linestart).toString() + "px",
    left: vleft.toString() + "px",
    borderLeft: arrowhalfwidth.toString() + "px solid transparent",
    borderRight: arrowhalfwidth.toString() + "px solid transparent",
    borderBottom: arrowlength.toString() + "px solid rgba(0, 255, 0)",
    position: "absolute"
  }, 10);
  addElement(uparrow);
  XYZaxes.append(uparrow);

  let yelm = createElement("div", { innerText: "y" }, {
    backgroundColor: "rgba(0, 255, 0, " + div_annotation_opacity + ")", color: "rgba(255, 255, 255, 1.0)",
    left: (vleft - linewidth / 2.0).toString() + "px",
    bottom: labelfromarrow.toString() + "px",
    padding: "1px",
    position: "absolute"
  }, fontsize);
  addElement(yelm);
  XYZaxes.append(yelm);

  let helm = createElement("div", { innerText: "" }, {
    backgroundColor: "rgba(0, 0, 255, 1.0)", color: "rgba(0, 0, 0, 0.0)",
    left: linestart.toString() + "px",
    width: linelength.toString() + "px",
    bottom: (hbottom + arrowhalfwidth - linewidth / 2.0).toString() + "px",
    height: linewidth.toString() + "px",
    position: "absolute"
  }, 10);
  addElement(helm);
  XYZaxes.append(helm);

  let rightarrow = createElement("div", { innerText: "" }, {
    backgroundColor: "rgba(0, 0, 255, 0.0)", color: "rgba(0, 0, 0, 0.0)",
    left: (linelength + linestart).toString() + "px",
    bottom: hbottom.toString() + "px",
    borderTop: arrowhalfwidth.toString() + "px solid transparent",
    borderBottom: arrowhalfwidth.toString() + "px solid transparent",
    borderLeft: arrowlength.toString() + "px solid rgba(0, 0, 255)",
    position: "absolute"
  }, 10);
  addElement(rightarrow);
  XYZaxes.append(rightarrow);

  let xelm = createElement("div", { innerText: "x" }, {
    backgroundColor: "rgba(0, 0, 255, " + div_annotation_opacity + ")", color: "rgba(255, 255, 255, 1.0)",
    left: labelfromarrow.toString() + "px",
    bottom: (hbottom + arrowhalfwidth - linewidth / 2.0).toString() + "px",
    padding: "1px",
    position: "absolute"
  }, fontsize);
  addElement(xelm);
  XYZaxes.append(xelm);

  let arrowradius = 10;
  let zarrow = createElement("div", { innerText: "" }, {
    backgroundColor: "rgba(255,0 ,0, 1.0)", color: "rgba(0, 0, 0, 1.0)",
    left: (linelength / 2 + linestart).toString() + "px",
    bottom: (linelength / 2 + linestart).toString() + "px",
    height: arrowradius.toString() + "px",
    width: arrowradius.toString() + "px",
    borderRadius: "50%",
    position: "absolute"
  }, 10);
  addElement(zarrow);
  XYZaxes.append(zarrow);

  let zarrowtip = createElement("div", { innerText: "" }, {
    backgroundColor: "rgba(255,255,255, 1.0)", color: "rgba(0, 0, 0, 1.0)",
    left: (arrowradius / 2 + linelength / 2 + linestart - 1).toString() + "px",
    bottom: (arrowradius / 2 + linelength / 2 + linestart - 1).toString() + "px",
    height: "2px",
    width: "2px",
    borderRadius: "50%",
    position: "absolute"
  }, 10);
  addElement(zarrowtip);
  XYZaxes.append(zarrowtip);

  let zelm = createElement("div", { innerText: "z" }, {
    backgroundColor: "rgba(255, 0, 0, " + div_annotation_opacity + ")", color: "rgba(255, 255, 255, 1.0)",
    left: (arrowradius + linelength / 2 + linestart).toString() + "px",
    bottom: (arrowradius + linelength / 2 + linestart).toString() + "px",
    padding: "1px",
    position: "absolute"
  }, fontsize);
  addElement(zelm);
  XYZaxes.append(zelm);
}



function HKLscene()
{
  stage = new NGL.Stage('viewport', {  backgroundColor: "rgb(128, 128, 128)",
                                    tooltip:false, // create our own tooltip from a div element
                                    fogNear: 100, fogFar: 100 });

  stage.setParameters( { cameraType: camtype } );
// create tooltip element and add to the viewer canvas
  stage.viewer.container.appendChild(tooltip);
  // Always listen to click event as to display any symmetry hkls
  stage.signals.clicked.add(ClickPickingProxyfunc);
  //stage.mouseControls.add("clickPick-right", ClickPickingProxyfunc);

  stage.mouseObserver.signals.dragged.add(
    function ( deltaX, deltaY)
    {
      if (clipFixToCamPosZ === true)
      {
        stage.viewer.parameters.clipNear = origclipnear + (origcameraZpos -stage.viewer.camera.position.z);
        stage.viewer.parameters.clipFar = origclipfar + (origcameraZpos -stage.viewer.camera.position.z);
        stage.viewer.requestRender();
      }
      let msg = getOrientMsg();
      rightnow = timefunc();
      if (rightnow - timenow > 250)
      { // only post every 250 milli second as not to overwhelm python
        postrotmxflag = true;
        WebsockSendMsg('CurrentViewOrientation:\n' + msg );
        timenow = timefunc();
      }
      tooltip.style.display = "none";
    }
  );


  stage.mouseObserver.signals.clicked.add(
    function (x, y)
    {
      let msg = getOrientMsg();
      WebsockSendMsg('CurrentViewOrientation:\n' + msg );
    }
  );


  stage.mouseObserver.signals.scrolled.add(
    function (delta)
    {
      if (clipFixToCamPosZ === true)
      {
        stage.viewer.parameters.clipNear = origclipnear + (origcameraZpos -stage.viewer.camera.position.z);
        stage.viewer.parameters.clipFar = origclipfar + (origcameraZpos -stage.viewer.camera.position.z);
        stage.viewer.requestRender();
      }
      let msg = getOrientMsg();
      rightnow = timefunc();
      if (rightnow - timenow > 250)
      { // only post every 250 milli second as not to overwhelm python
        WebsockSendMsg('CurrentViewOrientation:\n' + msg );
        timenow = timefunc();
      }
      tooltip.style.display = "none";
    }
  );


  stage.viewer.signals.rendered.add(
    function()
    {
      if (postrotmxflag === true)
      {
        let msg = getOrientMsg();
        WebsockSendMsg('CurrentViewOrientation:\n' + msg );
        postrotmxflag = false;
      }
    }
  );


  stage.viewerControls.signals.changed.add(
    function()
    {
      let msg = getOrientMsg();
      rightnow = timefunc();
      if (rightnow - timenow > 250)
      { // only post every 250 milli second as not to overwhelm python
        WebsockSendMsg('CurrentViewOrientation:\n' + msg );
        //ReturnClipPlaneDistances();
        sleep(250).then(()=> {
            ReturnClipPlaneDistances();
          }
        );
        timenow = timefunc();
      }
    }
  );

  function SetDefaultOrientation()
  {
    if (shapeComp == null)
      return;
    let m4 = new NGL.Matrix4();
    let axis = new NGL.Vector3();
    axis.x = 0.0;
    axis.y = 1.0;
    axis.z = 0.0;
    // Default in WebGL is for x-axis to point left and z-axis to point into the screen.
    // But we want x-axis pointing right and z-axis pointing out of the screen. 
    // Rotate coordinate system to that effect
    m4.makeRotationAxis(axis, Math.PI);
    shapeComp.autoView(500);
    stage.viewerControls.orient(m4);
  }

  SetDefaultOrientation();

  if (isdebug)
    stage.viewer.container.appendChild(debugmessage);

  // avoid NGL zoomFocus messing up clipplanes positions. So reassign those signals to zoomDrag
  stage.mouseControls.remove("drag-shift-right");
  stage.mouseControls.add("drag-shift-right", NGL.MouseActions.zoomDrag);
  stage.mouseControls.remove("drag-middle");
  stage.mouseControls.add("drag-middle", NGL.MouseActions.zoomDrag);
  stage.mouseControls.remove('clickPick-left'); // avoid undefined move-pick when clicking on a sphere

  stage.viewer.requestRender();
  if (isdebug)
    debugmessage.innerText = dbgmsg;

  ResetViewBtn = createElement("input", {
    value: "Reset view",
    type: "button",
    onclick: function () {
      SetDefaultOrientation();
      RenderRequest();
      sleep(100).then(() => {
        let msg = getOrientMsg();
        WebsockSendMsg('CurrentViewOrientation:\n' + msg);
      }
      );
    },
  }, { bottom: "10px", left: "10px", width: "90px", position: "absolute" }, fontsize);
  addElement(ResetViewBtn);

}


function OnUpdateOrientation()
{
  let msg = getOrientMsg();
  WebsockSendMsg('MouseMovedOrientation:\n' + msg );
}


function PageLoad()
{
  try
  {
    //alert('In PageLoad');
    document.addEventListener('DOMContentLoaded', function () { HKLscene(); }, false );
    document.addEventListener('mouseup', function () { OnUpdateOrientation(); }, false );
    document.addEventListener('wheel', function (e) { OnUpdateOrientation(); }, false );
    document.addEventListener('scroll', function (e) { OnUpdateOrientation(); }, false );
    // mitigate flickering on some PCs when resizing
    document.addEventListener('resize', function () { RenderRequest(); }, false);
 }
  catch(err)
  {
    WebsockSendMsg('JavaScriptError: ' + err.stack );
  }
}


PageLoad();
