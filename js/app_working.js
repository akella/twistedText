import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import fragment from "./shader/fragment.glsl";
import vertex from "./shader/vertex.glsl";
import GUI from "lil-gui";
import gsap from "gsap";

import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import matcap from "../tomato.png";
import {mergeBufferGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js"

require("./extend");

// import font from '../font.json'
// console.log(font)

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene();
    this.scene1 = new THREE.Scene();

    this.group = new THREE.Group();
    this.group1 = new THREE.Group();

    this.scene.add(this.group);
    this.scene1.add(this.group1);

    this.container = options.dom;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.5));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x111111, 1);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // this.renderer.setScissorTest(true);
    // this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.loader = new FontLoader();

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      0.1,
      100
    );

    var frustumSize = 4;
    var aspect = ( window.innerWidth) / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      -1000,
      1000
    );
    this.camera.position.set(0, 0, 4);

    this.camera1 = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      -1000,
      1000
    );
    this.camera1.position.set(0, 0, 4);


    // this.group.position.x = frustumSize*aspect/2
    // this.group1.position.x = -frustumSize*aspect/2
    this.group.rotation.x = Math.PI/4
    this.group1.rotation.x = -Math.PI/4

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(
      "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/js/libs/draco/"
    ); // use a full url path
    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.dracoLoader);

    this.isPlaying = true;

    this.addObjects();
    this.resize();
    this.render();
    this.setupResize();
    this.addLights();
    // this.settings();
  }

  settings() {
    let that = this;
    this.settings = {
      progress: 0,
    };
    this.gui = new GUI();
    this.gui.add(this.settings, "progress", 0, 1, 0.01);
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;

    this.camera.updateProjectionMatrix();
  }

  processGeometry(geometry,angle1,angle2) {
    let old = geometry.clone()
    old.center();
    let bounds = old.boundingBox;
    let width = bounds.max.x - bounds.min.x;
    let clone = old.clone();
    let clone1 = old.clone();
    clone.rotateX(angle1*Math.PI/2);
    clone1.rotateX(angle2*Math.PI/2);
    clone.translate(-width / 2, 0, 0);
    clone1.translate(width / 2, 0, 0);

    let merged = mergeBufferGeometries([clone, clone1]);

    return merged;


  }

  getMaterial(){
    let matcaptexture = new THREE.TextureLoader().load(matcap);
    matcaptexture.needsUpdate = true;

    let material = THREE.extendMaterial(THREE.MeshLambertMaterial, {
      // Class of the material you'd like to extend

      // Will be prepended to vertex and fragment code
      header: `
      varying vec3 vPosition;
      uniform float uOffset;
      uniform vec3 uMin;
      uniform vec3 uMax;
      uniform float time;
      float radius = 1.5;
      float twists = 2.;
      float PI = 3.141592653589793238;
mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
	mat4 m = rotationMatrix(axis, angle);
	return (m * vec4(v, 1.0)).xyz;
}
float mapRange(float value, float min1, float max1, float min2, float max2) {
  // return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  return clamp( min2 + (value - min1) * (max2 - min2) / (max1 - min1), min2, max2 );
}
      `,

      // Insert code lines by hinting at a existing
      vertex: {
        // Inserts the line after #include <fog_vertex>
        "#include <beginnormal_vertex>": `

          // objectNormal
          vPosition = position;
          
          float xx = mapRange(vPosition.x, uMin.x, uMax.x, -1., 1.0);
          // twistnormal
          // objectNormal = rotate(objectNormal, vec3(1.,0.,0.), PI*xx*0.5*twists + time*0.1);
  
          // circled normal
          objectNormal = rotate(objectNormal, vec3(0.,0.,1.), PI*xx + 0.05*time);
          `,
        "#include <begin_vertex>": `

        vec3 pos = transformed;
        
        
        // twist
        float xxx = mapRange(position.x, uMin.x, uMax.x, -1., 1.0);
        // pos = rotate(pos,vec3(1.,0.,0.), PI*xxx*0.5*twists + time*0.1);


        float theta = (xxx + 0.05*time)*PI  + uOffset;

        float twists = floor(mod(xxx + 0.05*time,4.));

        pos = rotate(pos,vec3(1.,0.,0.), 0.5*PI*twists);



        vec3 dir = vec3(sin(theta), cos(theta),pos.z);
        vec3 circled = vec3(dir.xy*radius,pos.z) + vec3(pos.y*dir.x,pos.y*dir.y,0.);
        // first center point,                     then add vertex offset from center

        transformed = circled;


        `,
      },
      fragment: {
        "vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;": `
        outgoingLight = diffuseColor.rgb*texture2D( matcap, uv ).rgb;
        `,
      },

      // Uniforms (will be applied to existing or added) as value or uniform object
      uniforms: {
        // Use a value directly
        // diffuse: new THREE.Color(0xffffff),
        roughness: { value: 0.6 },
        metalness: { value: 0.6 },
        uOffset: { value: 0. },
        time: {
          value: 0,
          mixed: true,
          linked: true,
        },
        uMin: {
          value: null,
          mixed: true,
          linked: true,
        },
        uMax: {
          value: null,
          mixed: true,
          linked: true,
        },
        matcap: { value: matcaptexture },
      },
    });
    // material.wireframe = true;
    return material;
  }

  addObjects() {

    this.material = this.getMaterial()
    this.material1 = this.getMaterial()
    this.material1.uniforms.uOffset.value = Math.PI


    this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    this.loader.load("/font.json", (font) => {
      this.geo = new TextGeometry("IMPOSSIBLE", {
        font: font,

        size: 0.4 * 2,
        height: 0.4*2,
        curveSegments: 14,

        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 10,
        bevelEnabled: true,
      });
      let temp =  this.geo.clone()
      this.geo = this.processGeometry(temp,0,0)
      // this.geo1 = this.processGeometry(temp,-1,0)
      this.geo.computeBoundingBox();
      this.geo.center();
      // this.geo1.center();

      if (this.material.uniforms) {
        this.material.uniforms.uMin.value = this.geo.boundingBox.min;
        this.material.uniforms.uMax.value = this.geo.boundingBox.max;

        this.material1.uniforms.uMin.value = this.geo.boundingBox.min;
        this.material1.uniforms.uMax.value = this.geo.boundingBox.max;
      }

      this.textmesh = new THREE.Mesh(this.geo, this.material);
      this.textmesh1 = new THREE.Mesh(this.geo, this.material1);

      let dd = THREE.extendMaterial(THREE.MeshDepthMaterial, {
        template: this.material,
      });

      this.textmesh.castShadow = this.textmesh.receiveShadow = true;
      this.textmesh1.castShadow = this.textmesh1.receiveShadow = true;
      this.textmesh.customDepthMaterial = dd;
      this.textmesh1.customDepthMaterial = dd;

      // this.textmesh.position.x = centerOffset;
      this.group.add(this.textmesh);
      this.group1.add(this.textmesh1);
    });

    let floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4, 100, 100).rotateX(Math.PI / 2),
      // new THREE.MeshStandardMaterial({ color: 0xffffff,side: THREE.DoubleSide })
      new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        side: THREE.DoubleSide,
      })
    );
    floor.position.y = -2;
    // this.scene.add(floor);
    floor.castShadow = floor.receiveShadow = true;
  }

  addLights() {
    const light1 = new THREE.AmbientLight(0xffffff, 0.5);
    const light11 = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(light1);
    this.scene1.add(light11);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    const light22 = new THREE.DirectionalLight(0xffffff, 0.5);
    // light2.position.set(0.5, 0, 0.866); // ~60º
    light2.position.set(1, 3, 2); // ~60º
    light22.position.set(1, 3, 2); // ~60º
    this.scene.add(light2);
    this.scene1.add(light22);
    console.log(light2);

    // light2.position.x = -5;
    //     light2.position.y = 5;
    //     light2.position.z = 3;
    // light2.position.normalize();
    // light2.shadow.bias = -0.000005;

    // light2.castShadow = true;
    // light2.shadow.camera.right = 3.5;
    // light2.shadow.camera.left = -3.5;
    // light2.shadow.camera.top = 3.5;
    // light2.shadow.camera.bottom = -3.5;
    // light2.shadow.mapSize.width = 2048;
    // light2.shadow.mapSize.height = 2048;

    const helper = new THREE.DirectionalLightHelper(light2, 5);
    // this.scene.add( helper );
  }

  stop() {
    this.isPlaying = false;
  }

  play() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.render();
    }
  }

  render() {
    if (!this.isPlaying) return;
    this.time += 0.05;
    // this.time = Math.PI/4
    if (this.material.uniforms) {
      this.material.uniforms.time.value = this.time;
      this.material1.uniforms.time.value = this.time;
    }

    


    //right
    // this.renderer.render(this.scene, this.camera);
    // this.renderer.setViewport(this.width / 2, 0, this.width / 2, this.height);
    // this.renderer.setScissor(this.width / 2, 0, this.width / 2, this.height);
    // this.renderer.render(this.scene1, this.camera1);


    // left
    // this.renderer.setViewport(0, 0, this.width / 2, this.height);
    // this.renderer.setScissor(0, 0, this.width / 2, this.height);
    // this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.render.bind(this));
  }
}

new Sketch({
  dom: document.getElementById("container"),
});
