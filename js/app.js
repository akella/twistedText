import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import matcap from "../assets/chemical_carpaint_blue.png";
import matcap1 from "../assets/tomato.png";
import matcap2 from "../assets/clay_alien.png";
import matcap3 from "../assets/metal_copper_flamed.png";
require("./extend");

let matcaps = [matcap, matcap1, matcap2, matcap3];
matcaps = matcaps.map((m) => new THREE.TextureLoader().load(m));


const FONTS = ["/font.json", "/font0.json", "/font1.json", "/font2.json"];

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
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.loader = new FontLoader();

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      0.1,
      100
    );

    this.camera.position.set(0, 0, 6);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = 4
    this.controls.maxDistance = 12
    this.time = 0;

    this.isPlaying = true;
    this.settings();
    this.addObjects();
    this.resize();
    this.render();
    this.setupResize();
    // this.addLights();
  }

  settings() {
    let that = this;
    this.settings = {
      text: "INCOMPREHENSIBILITY",
      fontSize: 1,
      rotateSpeed: 1,
      twistSpeed: 7.9,
      fontDepth: 0.3,
      radius: 2.8,
      twists: 2,
      visual: 0,
      font: 0,
    };
    this.gui = new GUI();


    this.gui.add(this.settings, "text").onChange(() => {
      this.updateGeometry();
    });
    this.gui.add(this.settings, "fontSize", 0, 1, 0.01).onChange(() => {
      this.updateGeometry();
    });
    this.gui.add(this.settings, "fontDepth", 0, 1, 0.01).onChange(() => {
      this.updateGeometry();
    });

    this.gui.add(this.settings, "radius", 1, 4, 0.01).onChange(() => {
      this.material.uniforms.uRadius.value = this.settings.radius;
    });
    this.gui.add(this.settings, "rotateSpeed", 0, 1, 0.01).onChange(() => {
      this.material.uniforms.uRotateSpeed.value = this.settings.rotateSpeed;
    });

    this.gui.add(this.settings, "visual", 0, 3, 1).onChange(() => {
      // update different matcaps
      this.material.uniforms.matcap.value = matcaps[this.settings.visual];
    });
    this.gui.add(this.settings, "font", 0, 3, 1).onChange(() => {
      this.updateGeometry();
    });
    this.gui.add(this.settings, "twists", 0, 3, 0.01).onChange(() => {
      this.material.uniforms.uTwists.value = this.settings.twists;
    });
    this.gui.add(this.settings, "twistSpeed", 0, 10, 0.01).onChange(() => {
      this.material.uniforms.uTwistSpeed.value = this.settings.twistSpeed;
    });
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

  updateGeometry() {
    this.loader.load(FONTS[this.settings.font], (font) => {
      this.geo = new TextGeometry(this.settings.text, {
        font: font,

        size: this.settings.fontSize,
        height: this.settings.fontDepth,
        curveSegments: 100,

        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 10,
        bevelEnabled: false,
      });

      this.geo.center();
      this.geo.computeBoundingBox();

      if (this.material.uniforms) {
        this.material.uniforms.uMin.value = this.geo.boundingBox.min;
        this.material.uniforms.uMax.value = this.geo.boundingBox.max 
        this.material.uniforms.uMax.value.x +=this.settings.fontSize/6;
      }

      this.textmesh.geometry = this.geo;
    });
  }

  getMaterial() {
    let matcaptexture = new THREE.TextureLoader().load(matcap);
    matcaptexture.needsUpdate = true;

    let material = THREE.extendMaterial(THREE.MeshMatcapMaterial, {
      // Class of the material you'd like to extend

      // Will be prepended to vertex and fragment code
      header: `
      varying vec3 vPosition;
      varying float vDebug;
      uniform float uOffset;
      uniform float uTwistSpeed;
      uniform float uRotateSpeed;
      uniform float uTwists;
      uniform float uRadius;
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
          objectNormal = rotate(objectNormal, vec3(1.,0.,0.), 0.5*PI*uTwists*xx + 0.01*time*uTwistSpeed);
  
          // circled normal
          objectNormal = rotate(objectNormal, vec3(0.,0.,1.), (xx + 0.01*time*uRotateSpeed)*PI);
          `,
        "#include <begin_vertex>": `

        vec3 pos = transformed;
        
        
        // twist + 
        float xxx = mapRange(position.x, uMin.x, uMax.x, -1., 1.);
        float theta = (xxx + 0.01*time*uRotateSpeed)*PI;
        pos = rotate(pos,vec3(1.,0.,0.), 0.5*PI*uTwists*xxx + 0.01*time*uTwistSpeed);


        
        vec3 dir = vec3(sin(theta), cos(theta),pos.z);
        vec3 circled = vec3(dir.xy*uRadius,pos.z) + vec3(pos.y*dir.x,pos.y*dir.y,0.);

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
        uOffset: { value: 0 },
        time: {
          value: 0,
          mixed: true,
          linked: true,
        },
        uRadius: {
          value: this.settings.radius,
          mixed: true,
          linked: true,
        },
        uTwists: {
          value: this.settings.twists,
          mixed: true,
          linked: true,
        },
        uTwistSpeed: {
          value: this.settings.twistSpeed,
          mixed: true,
          linked: true,
        },
        uRotateSpeed: {
          value: this.settings.rotateSpeed,
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
    this.material = this.getMaterial();

    this.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    this.loader.load("/font1.json", (font) => {
      this.geo = new TextGeometry(this.settings.text, {
        font: font,

        size: this.settings.fontSize,
        height: this.settings.fontDepth,
        curveSegments: 100,

        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 10,
        bevelEnabled: false,
      });
      this.geo.center();
      this.geo.computeBoundingBox();

      // this.geo1.center();

      if (this.material.uniforms) {
        this.material.uniforms.uMin.value = this.geo.boundingBox.min;
        this.material.uniforms.uMax.value = this.geo.boundingBox.max;
        this.material.uniforms.uMax.value.x +=this.settings.fontSize/6;
      }

      this.textmesh = new THREE.Mesh(this.geo, this.material);

      // let dd = THREE.extendMaterial(THREE.MeshDepthMaterial, {
      //   template: this.material,
      // });

      // this.textmesh.castShadow = this.textmesh.receiveShadow = true;
      // this.textmesh.customDepthMaterial = dd;

      this.group.add(this.textmesh);
    });

    // let floor = new THREE.Mesh(
    //   new THREE.PlaneGeometry(6.4, 6.4, 100, 100).rotateX(Math.PI / 2),
    //   // new THREE.MeshStandardMaterial({ color: 0xffffff,side: THREE.DoubleSide })
    //   new THREE.MeshStandardMaterial({
    //     color: 0xcccccc,
    //     side: THREE.DoubleSide,
    //   })
    // );
    // floor.position.y = -2;
    // this.scene.add(floor);
    // floor.castShadow = floor.receiveShadow = true;
  }

  addLights() {
    const light1 = new THREE.AmbientLight(0xffffff, 0.5);
    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(0, 1, 0); // ~60º
    this.scene.add(light2);

    // const helper = new THREE.DirectionalLightHelper(light2, 5);
    // this.scene.add( helper );

    // const axesHelper = new THREE.AxesHelper(50);
    // this.scene.add(axesHelper);
  }

  render() {
    if (!this.isPlaying) return;
    this.time += 0.05;
    if (this.material.uniforms) {
      this.material.uniforms.time.value = this.time;
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }
}

new Sketch({
  dom: document.getElementById("container"),
});
