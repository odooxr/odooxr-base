import {WebXRButton} from './util/webxr-button.js';
import {Scene} from './render/scenes/scene.js';
import {Renderer, createWebGLContext} from './render/core/renderer.js';
import {Gltf2Node} from './render/nodes/gltf2.js';
import {SkyboxNode} from './render/nodes/skybox.js';
import {mat4, vec3, quat} from './render/math/gl-matrix.js';
import {QueryArgs} from './util/query-args.js';


import WebXRPolyfill from './third-party/webxr-polyfill/build/webxr-polyfill.module.js';
if (QueryArgs.getBool('usePolyfill', true)) {
  let polyfill = new WebXRPolyfill();
}

let webxrPolyfill = null;
let inlineSession = null;

// XR globals.
let xrButton = null;
let xrImmersiveRefSpace = null;
let xrInlineRefSpace = null;

// WebGL scene globals.
let gl = null;
let renderer = null;
let scene = new Scene();
let solarSystem = new Gltf2Node({url: '/odooxr-base/static/media/gltf/space/space.gltf'});
scene.addNode(solarSystem);
scene.addNode(new SkyboxNode({url: '/odooxr-base/static/media/textures/milky-way-4k.png'}));


function getXR(usePolyfill) {
  let tempXR;

  switch(usePolyfill) {
    case "if-needed":
      tempXR = navigator.xr;
      if (!tempXR) {
        webxrPolyfill = new WebXRPolyfill();
        tempXR = webxrPolyfill;
      }
      break;
    case "yes":
      webxrPolyfill = new WebXRPolyfill();
      tempXR = webxrPolyfill;
      break;
    case "no":
    default:
      tempXR = navigator.xr;
      break;
  }

  return tempXR;
}

async function createImmersiveSession(xr) {
  try {
    session = await xr.requestSession("immersive-vr");
    return session;
  } catch(error) {
    throw error;
  }
}

function onSessionStarted(session) {
  session.addEventListener('end', onSessionEnded);

  if (!gl) {
    gl = createWebGLContext({
      xrCompatible: true
    });
    // Set style
    gl.canvas.style.cssText += "top: 0px;position: absolute;margin-left: auto;margin-right: auto;left: 0px;right: 0px;; widht: 100%; height: 100%"

    // In order for an inline session to be used we must attach the WebGL
    // canvas to the document, which will serve as the output surface for
    // the results of the inline session's rendering.
    let canvas_container = document.querySelector("#vr-canvas")
    canvas_container.insertBefore(gl.canvas, canvas_container.firstChild);
    
    // The canvas is synced with the window size via CSS, but we still
    // need to update the width and height attributes in order to keep
    // the default framebuffer resolution in-sync.
    function onResize() {
      gl.canvas.width = gl.canvas.clientWidth * window.devicePixelRatio;
      gl.canvas.height = gl.canvas.clientHeight * window.devicePixelRatio;
    }
    window.addEventListener('resize', onResize);
    onResize();

    // Installs the listeners necessary to allow users to look around with
    // inline sessions using the mouse or touch.
    addInlineViewListeners(gl.canvas);

    renderer = new Renderer(gl);

    scene.setRenderer(renderer);
  }
  // WebGL layers for inline sessions won't allocate their own framebuffer,
  // which causes gl commands to naturally execute against the default
  // framebuffer while still using the canvas dimensions to compute
  // viewports and projection matrices.
  let glLayer = new XRWebGLLayer(session, gl);

  session.updateRenderState({
    baseLayer: glLayer
  });

  let refSpaceType = session.isImmersive ? 'local' : 'viewer';
  session.requestReferenceSpace(refSpaceType).then((refSpace) => {
    // Since we're dealing with multiple sessions now we need to track
    // which XRReferenceSpace is associated with which XRSession.
    if (session.isImmersive) {
      xrImmersiveRefSpace = refSpace;
    } else {
      xrInlineRefSpace = refSpace;
    }
    session.requestAnimationFrame(onXRFrame);
  });
}

export function initXR() {
  xrButton = new WebXRButton({
    onRequestSession: onRequestSession,
    onEndSession: onEndSession
  });
  xrButton.domElement.style.cssText += "left: 50%;transform: translateX(-50%);";

  document.querySelector('#vr-canvas').appendChild(xrButton.domElement);

  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      xrButton.enabled = supported;
    });

    // Start up an inline session, which should always be supported on
    // browsers that support WebXR regardless of the available hardware.
    navigator.xr.requestSession('inline').then((session) => {
      inlineSession = session;
      onSessionStarted(session);
    });
  }
}

function onRequestSession() {
  return navigator.xr.requestSession('immersive-vr').then((session) => {
    xrButton.setSession(session);
    // Set a flag on the session so we can differentiate it from the
    // inline session.
    session.isImmersive = true;
    onSessionStarted(session);
  });
}

function onEndSession(session) {
  session.end();
}

function onSessionEnded(event) {
  // Only reset the button when the immersive session ends.
  if (event.session.isImmersive) {
    xrButton.setSession(null);
  }
}


// Make the canvas listen for mouse and touch events so that we can
// adjust the viewer pose accordingly in inline sessions.
function addInlineViewListeners(canvas) {
  canvas.addEventListener('mousemove', (event) => {
    // Only rotate when the right button is pressed
    if (event.buttons && 2) {
      rotateView(event.movementX, event.movementY);
    }
  });

  // Keep track of touch-related state so that users can touch and drag on
  // the canvas to adjust the viewer pose in an inline session.
  let primaryTouch = undefined;
  let prevTouchX = undefined;
  let prevTouchY = undefined;

  // Keep track of all active touches, but only use the first touch to
  // adjust the viewer pose.
  canvas.addEventListener("touchstart", (event) => {
    if (primaryTouch == undefined) {
      let touch = event.changedTouches[0];
      primaryTouch = touch.identifier;
      prevTouchX = touch.pageX;
      prevTouchY = touch.pageY;
    }
  });

  // Update the set of active touches now that one or more touches
  // finished. If the primary touch just finished, update the viewer pose
  // based on the final touch movement.
  canvas.addEventListener("touchend", (event) => {
    for (let touch of event.changedTouches) {
      if (primaryTouch == touch.identifier) {
        primaryTouch = undefined;
        rotateView(touch.pageX - prevTouchX, touch.pageY - prevTouchY);
      }
    }
  });

  // Update the set of active touches now that one or more touches was
  // cancelled. Don't update the viewer pose when the primary touch was
  // cancelled.
  canvas.addEventListener("touchcancel", (event) => {
    for (let touch of event.changedTouches) {
      if (primaryTouch == touch.identifier) {
        primaryTouch = undefined;
      }
    }
  });

  // Only use the delta between the most recent and previous events for
  // the primary touch. Ignore the other touches.
  canvas.addEventListener("touchmove", (event) => {
    for (let touch of event.changedTouches) {
      if (primaryTouch == touch.identifier) {
        rotateView(touch.pageX - prevTouchX, touch.pageY - prevTouchY);
        prevTouchX = touch.pageX;
        prevTouchY = touch.pageY;
      }
    }
  });
}

// Called every time a XRSession requests that a new frame be drawn.
function onXRFrame(t, frame) {
  let session = frame.session;
  // Ensure that we're using the right frame of reference for the session.
  let refSpace = session.isImmersive ?
                   xrImmersiveRefSpace :
                   xrInlineRefSpace;

  // Account for the click-and-drag mouse movement or touch movement when
  // calculating the viewer pose for inline sessions.
  if (!session.isImmersive) {
    refSpace = getAdjustedRefSpace(refSpace);
  }

  let pose = frame.getViewerPose(refSpace);

  scene.startFrame();

  session.requestAnimationFrame(onXRFrame);

  if (pose) {
    let glLayer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (let view of pose.views) {
      let viewport = glLayer.getViewport(view);
      gl.viewport(viewport.x, viewport.y,
                  viewport.width, viewport.height);

      scene.draw(view.projectionMatrix, view.transform);
    }
  }

  scene.endFrame();
}


// Inline view adjustment code
// Allow the user to click and drag the mouse (or touch and drag the
// screen on handheld devices) to adjust the viewer pose for inline
// sessions. Samples after this one will hide this logic with a utility
// class (InlineViewerHelper).
let lookYaw = 0;
let lookPitch = 0;
const LOOK_SPEED = 0.0025;

// XRReferenceSpace offset is immutable, so return a new reference space
// that has an updated orientation.
function getAdjustedRefSpace(refSpace) {
  // Represent the rotational component of the reference space as a
  // quaternion.
  let invOrientation = quat.create();
  quat.rotateX(invOrientation, invOrientation, -lookPitch);
  quat.rotateY(invOrientation, invOrientation, -lookYaw);
  let xform = new XRRigidTransform(
      {x: 0, y: 0, z: 0},
      {x: invOrientation[0], y: invOrientation[1], z: invOrientation[2], w: invOrientation[3]});
  return refSpace.getOffsetReferenceSpace(xform);
}

function rotateView(dx, dy) {
  lookYaw += dx * LOOK_SPEED;
  lookPitch += dy * LOOK_SPEED;
  if (lookPitch < -Math.PI*0.5)
      lookPitch = -Math.PI*0.5;
  if (lookPitch > Math.PI*0.5)
      lookPitch = Math.PI*0.5;
}

odoo.define('odooxr-base.website', ["web.core"], function(require) {
   "use strict";

   var core = require('web.core');

   $(document).ready(() => { initXR(); });
})

