
import * as THREE from "three";

// Author: Fyrestar https://mevedia.com (https://github.com/Fyrestar/THREE.extendMaterial)

const {

	ShaderChunk,
	UniformsLib,
	Vector2,
	Color,
	EventDispatcher,

	TangentSpaceNormalMap,
	MultiplyOperation,

	Material,
	ShaderMaterial,
	RawShaderMaterial

} = THREE;


// Fix missing pairs

UniformsLib.clearcoatnormalmap = {
	clearcoatNormalScale: { value: new Vector2( 1, 1 ) }
};


// Patch materials

const Materials = [
	'MeshDistanceMaterial',
	'MeshMatcapMaterial',
	'ShadowMaterial',
	'SpriteMaterial',
	'RawShaderMaterial',
	'ShaderMaterial',
	'PointsMaterial',
	'MeshPhysicalMaterial',
	'MeshStandardMaterial',
	'MeshPhongMaterial',
	'MeshToonMaterial',
	'MeshNormalMaterial',
	'MeshLambertMaterial',
	'MeshDepthMaterial',
	'MeshBasicMaterial',
	'LineDashedMaterial',
	'LineBasicMaterial',
	'Material',
	'MeshFaceMaterial',
	'MultiMaterial',
	'PointCloudMaterial',
	'ParticleBasicMaterial',
	'ParticleSystemMaterial'
];


for ( let name of Materials ) {

	if ( THREE[ name ] !== undefined ) {

		const prototype = THREE[ name ].prototype;

		// Type on prototype needed to identify when minified

		prototype.type = name;
		prototype.customDepthMaterial = null;
		prototype.customDistanceMaterial = null;
		prototype.templates = [];

	}

}


// New material methods

const _clone = ShaderMaterial.prototype.clone;

function clone() {

	const clone = _clone.call( this );

	clone.templates = this.templates;

	return clone;

}

function link( source ) {

	if ( source && source.uniforms ) {

		for ( let name in source.uniforms ) {

			if ( source.uniforms[ name ].linked )
				this.uniforms[ name ] = source.uniforms[ name ];

		}

	}

	return this;

}

function copy( source ) {

	Material.prototype.copy.call( this, source );

	for ( let name of mapList ) {

		if ( source[ name ] )
			this[ name ] = source[ name ];

	}

	for ( let name of localsList ) {

		if ( source[ name ] )
			this[ name ] = source[ name ];

	}

	this.fragmentShader = source.fragmentShader;
	this.vertexShader = source.vertexShader;

	this.uniforms = cloneUniforms( source.uniforms );

	this.defines = Object.assign( {}, source.defines );

	this.wireframe = source.wireframe;
	this.wireframeLinewidth = source.wireframeLinewidth;

	this.lights = source.lights;
	this.clipping = source.clipping;

	this.skinning = source.skinning;

	this.morphTargets = source.morphTargets;
	this.morphNormals = source.morphNormals;

	this.extensions = source.extensions;


	if ( source.customDepthMaterial )
		this.customDepthMaterial = source.customDepthMaterial.clone().link( this );

	if ( source.customDistanceMaterial )
		this.customDistanceMaterial = source.customDistanceMaterial.clone().link( this );


	return this;

}

function uniform( name ) {

	if ( this.uniforms[ name ] === undefined )
		this.uniforms[ name ] = { value: null };

	return this.uniforms[ name ];

}

function extend( source, object ) {

	object = object || {};


	// Extend from class or shader material

	let uniforms = {}, vertexShader = '', fragmentShader = '';


	// Inherit from previous material templates chain

	const base = object.template || object.extends;
	const MaterialClass = object.class || ( source.isMaterial && source.constructor ? source.constructor : null ) || CustomMaterial;


	// New shader material

	const material = new MaterialClass;
	const properties = object.material = object.material || {};
	const defines = Object.assign( {}, properties.defines );


	// Template chain

	material.templates = [ object ];

	if ( source.templates instanceof Array )
		material.templates = source.templates.concat( material.templates );

	let name;

	if ( source instanceof Function ) {

		// Source is a constructor

		name = source.prototype.type;
		const mapping = mappings[ name ];

		if ( mapping === undefined ) {

			console.error( 'THREE.extendMaterial: no mapping for material class "%s" found', name );

			return material;

		}


		properties.lights = properties.lights === undefined ? true : properties.lights;

		uniforms = mapUniforms( mapping.name, uniforms, object );   // Use only declared/necessary uniforms or all
		vertexShader = ShaderChunk[ mapping.id + '_vert' ];
		fragmentShader = ShaderChunk[ mapping.id + '_frag' ];


	} else if ( source.isShaderMaterial ) {

		// Source is a ShaderMaterial

		name = source.type;

		uniforms = cloneUniforms( source.uniforms, uniforms );    // Use uniforms of previous material
		vertexShader = source.vertexShader;
		fragmentShader = source.fragmentShader;

		material.copy( source, false );

		if ( source.defines )
			Object.assign( defines, source.defines );

	} else {

		// Source is a material instance

		name = source.type;
		const mapping = mappings[ name ];

		if ( mapping === undefined ) {

			console.error( 'THREE.extendMaterial: no mapping for material class "%s" found', name );

			return material;

		}


		properties.lights = properties.lights === undefined ? true : properties.lights;

		uniforms = mapUniforms( mapping.name, uniforms, object );
		vertexShader = ShaderChunk[ mapping.id + '_vert' ];
		fragmentShader = ShaderChunk[ mapping.id + '_frag' ];


		// Built-in properties to uniforms ( if explicit not disabled, those being null will be skipped )

		const defaults = THREE.ShaderLib[ mapping.name ].uniforms;

		for ( let name in defaults )
			if ( uniforms[ name ] === undefined && source[ name ] !== undefined && ( source[ name ] !== null || object.explicit === false ) ) {

				uniforms[ name ] = uniforms[ name ] || { value: null };
				uniforms[ name ].value = source[ name ];

			}

	}


	// ShaderMaterial in disguise ( currently not required )

	//if ( material.isCustomMaterial )
	//	material[ 'is' + name ] = true;


	// Override constants

	if ( object.defines )
		Object.assign( defines, object.defines );


	// A shared header ( varyings, uniforms, functions etc )

	let header = ( object.header || '' ) + '\n';


	// Insert or replace lines (@ to replace)

	if ( object.vertex !== undefined )
		vertexShader = applyPatches( vertexShader, object.vertex );


	if ( object.fragment !== undefined )
		fragmentShader = applyPatches( fragmentShader, object.fragment );


	properties.defines = defines;
	properties.uniforms = uniforms;
	properties.vertexShader = header + ( object.vertexHeader || '' ) + '\n' + vertexShader;
	properties.fragmentShader = header + ( object.fragmentHeader || '' ) + '\n' + fragmentShader;

	if ( object.vertexEnd )
		properties.vertexShader = properties.vertexShader.replace( /\}(?=[^.]*$)/g, object.vertexEnd + '\n}' );

	if ( object.fragmentEnd )
		properties.fragmentShader = properties.fragmentShader.replace( /\}(?=[^.]*$)/g, object.fragmentEnd + '\n}' );


	// Uniforms override

	if ( object.override ) {

		for ( let name in object.override ) {

			const src = object.override[ name ];
			const dst = uniforms[ name ] = uniforms[ name ] || { value: null };

			for ( let k in src )
				dst[ k ] = src[ k ];

			// Expose mixed uniforms to template if not exposed yet ( material before might have been built-in )

			if ( dst.mixed ) {

				if ( !object.uniforms )
					object.uniforms = {};

				object.uniforms[ name ] = dst;

			}

		}

	}


	// Apply base templates, uniforms that are required in a template must be flagged as mixed to get inherited

	if ( base && base.templates && base.templates.length ) {

		object.class = object.class || base.class;

		for ( let template of base.templates )
			patchShader( properties, template, mixUniforms, defines );


		// Linked uniforms: Assign linked uniforms of base template material

		for ( let name in base.uniforms ) {

			const src = base.uniforms[ name ];

			if ( src.linked )
				uniforms[ name ] = src;

		}

	}


	// Applies uniforms defined for this new material

	applyUniforms( material, object, properties, defines );


	// Finally apply material properties

	material.setValues( properties );

	if ( material.isCustomMaterial ) {

		for ( let name in uniforms ) {

			if ( mapFlags[ name ] && uniforms[ name ].value )
				material[ name ] = uniforms[ name ].value;

		}

	}


	// Fix: since we use #ifdef false would be false positive

	for ( let name in defines )
		if ( defines[ name ] === false )
			delete defines[ name ];

	// Fix: default for depth material packing

	if ( ( source.isMeshDepthMaterial || source === THREE.MeshDepthMaterial ) && defines.DEPTH_PACKING === undefined )
		defines.DEPTH_PACKING = THREE.RGBADepthPacking;


	return material;


}

Object.assign( RawShaderMaterial.prototype, { extend, uniform, clone, link, copy } );
Object.assign( ShaderMaterial.prototype, { extend, uniform, clone, link, copy } );


// Polyfill to allow custom depth/distance materials as material variation

if ( ShaderMaterial.prototype.customDepthMaterial !== undefined ) {

	const MeshPolyfill = {

		_customDepthMaterial: {
			enumerable: true,
			value: undefined,
			writable: true
		},

		_customDistanceMaterial: {
			enumerable: true,
			value: undefined,
			writable: true
		},

		customDepthMaterial: {

			get: function () {

				return this._customDepthMaterial || ( this.material && this.material.customDepthMaterial ? this.material.customDepthMaterial : undefined );

			},

			set: function ( value ) {

				this._customDepthMaterial = value;

			}

		},

		customDistanceMaterial: {

			get: function () {

				return this._customDistanceMaterial || ( this.material && this.material.customDistanceMaterial ? this.material.customDistanceMaterial : undefined );

			},

			set: function ( value ) {

				this._customDistanceMaterial = value;

			}

		}

	};

	Object.defineProperties( THREE.Mesh.prototype, MeshPolyfill );
	Object.defineProperties( THREE.SkinnedMesh.prototype, MeshPolyfill );

}


// A built-in materials compatible ShaderMaterial

extend.CustomMaterial = function CustomMaterial( object ) {

	ShaderMaterial.call( this, object );

	this.type = 'CustomMaterial';

};

Object.assign(
	extend.CustomMaterial.prototype,
	Material.prototype,
	ShaderMaterial.prototype,
	EventDispatcher.prototype,
	{

		isShaderMaterial: true,
		isCustomMaterial: true,
		isMeshPhongMaterial: false,
		isMeshDistanceMaterial: false,
		isMeshMatcapMaterial: false,
		isShadowMaterial: false,
		isSpriteMaterial: false,
		isRawShaderMaterial: false,
		isPointsMaterial: false,
		isMeshPhysicalMaterial: false,
		isMeshStandardMaterial: false,
		isMeshPhongMaterial: false,
		isMeshToonMaterial: false,
		isMeshNormalMaterial: false,
		isMeshLambertMaterial: false,
		isMeshDepthMaterial: false,
		isMeshBasicMaterial: false,
		isLineDashedMaterial: false,
		isLineBasicMaterial: false,
		isMaterial: false,
		isMeshFaceMaterial: false,
		isMultiMaterial: false,
		isPointCloudMaterial: false,
		isParticleBasicMaterial: false,
		isParticleSystemMaterial: false,

		constructor: extend.CustomMaterial,

		map: null,
		aoMap: null,
		envMap: null,
		bumpMap: null,
		normalMap: null,
		lightMap: null,
		emissiveMap: null,
		specularMap: null,
		roughnessMap: null,
		metalnessMap: null,
		alphaMap: null,
		displacementMap: null,
		clearcoatMap: null,
		clearcoatRoughnessMap: null,
		clearcoatNormalMap: null,

		normalMapType: TangentSpaceNormalMap,
		combine: MultiplyOperation,

		clone: function ( source ) {

			const clone = _clone.call( this );

			if ( this.map ) clone.map = this.map;
			if ( this.aoMap ) clone.aoMap = this.aoMap;
			if ( this.envMap ) clone.envMap = this.envMap;
			if ( this.bumpMap ) clone.bumpMap = this.bumpMap;
			if ( this.normalMap ) clone.normalMap = this.normalMap;
			if ( this.lightMap ) clone.lightMap = this.lightMap;
			if ( this.emissiveMap ) clone.emissiveMap = this.emissiveMap;
			if ( this.specularMap ) clone.specularMap = this.specularMap;
			if ( this.roughnessMap ) clone.roughnessMap = this.roughnessMap;
			if ( this.metalnessMap ) clone.metalnessMap = this.metalnessMap;
			if ( this.alphaMap ) clone.alphaMap = this.alphaMap;
			if ( this.displacementMap ) clone.displacementMap = this.displacementMap;
			if ( this.clearcoatMap ) clone.clearcoatMap = this.clearcoatMap;
			if ( this.clearcoatRoughnessMap ) clone.clearcoatRoughnessMap = this.clearcoatRoughnessMap;
			if ( this.clearcoatNormalMap ) clone.clearcoatNormalMap = this.clearcoatNormalMap;

			clone.templates = this.templates;

			return clone;
		}

	}
);

Object.defineProperties( extend.CustomMaterial.prototype, {

	reflectivity: {

		get: function () {

			return this.uniforms.reflectivity ? this.uniforms.reflectivity.value : 0;

		},

		set: function ( value ) {

			this.uniforms.reflectivity.value = value;

		}

	},

	specular: {

		get: function () {

			if ( this.uniforms.specular === undefined )
				this.uniforms.specular = { value: new THREE.Color( 'white' ) };

			return this.uniforms.specular.value;

		},

		set: function ( value ) {

			if ( this.uniforms.specular === undefined )
				this.uniforms.specular = { value };

			this.uniforms.specular.value = value;

		}

	},

	shininess: {

		get: function () {

			return this.uniforms.shininess ? this.uniforms.shininess.value : 0;

		},

		set: function ( value ) {

			if ( this.uniforms.shininess === undefined )
				this.uniforms.shininess = { value };

			this.uniforms.shininess.value = value;

		}

	}

} );

// Wrap ES6

if ( !Object.isExtensible( THREE ) || parseInt( THREE.REVISION ) > 126 ) {

	class CustomMaterial extends ShaderMaterial {

		constructor( object ) {

			super( object );

			this.type = 'CustomMaterial';

		}

		get specular () {

			if ( this.uniforms.specular === undefined )
				this.uniforms.specular = { value: new THREE.Color( 'white' ) };

			return this.uniforms.specular.value;

		}

		set specular ( value ) {

			if ( this.uniforms.specular === undefined )
				this.uniforms.specular = { value };

			this.uniforms.specular.value = value;

		}



		get shininess () {

			return this.uniforms.shininess ? this.uniforms.shininess.value : 0;

		}

		set shininess ( value ) {

			if ( this.uniforms.shininess === undefined )
				this.uniforms.shininess = { value };

			this.uniforms.shininess.value = value;

		}



		get reflectivity () {

			return this.uniforms.reflectivity ? this.uniforms.reflectivity.value : 0;

		}

		set reflectivity ( value ) {

			this.uniforms.reflectivity.value = value;

		}

	}


	Object.assign( CustomMaterial, extend.CustomMaterial )
	Object.assign( CustomMaterial.prototype, extend.CustomMaterial.prototype, { copy, clone } );


	extend.CustomMaterial = CustomMaterial;
}


// Alias

const extendMaterial = extend;
const CustomMaterial = extendMaterial.CustomMaterial;



let sharedLightsUniforms;

// Class name to internal lib names

const localsList = [
	'bumpScale',
	'roughness',
	'metalness',
	'shininess',
	'envMapIntensity',
	'opacity',
	'dashSize',
	'totalSize'
];

const localsMapping = {
	bumpScale: 'bumpScale',
	roughness: 'roughness',
	metalness: 'metalness',
	shininess: 'shininess',
	envMapIntensity: 'envMapIntensity',
	opacity: 'opacity',
	dashSize: 'dashSize',
	totalSize: 'totalSize'
};

const mapList = [
	'map',
	'aoMap',
	'envMap',
	'bumpMap',
	'normalMap',
	'lightMap',
	'emissiveMap',
	'specularMap',
	'roughnessMap',
	'metalnessMap',
	'alphaMap',
	'displacementMap'
];

const mappings = {
	MeshLambertMaterial: {
		id: 'meshlambert',
		name: 'lambert'
	},
	MeshBasicMaterial: {
		id: 'meshbasic',
		name: 'basic'
	},
	MeshStandardMaterial: {
		id: 'meshphysical',
		name: 'physical'
	},
	MeshPhongMaterial: {
		id: 'meshphong',
		name: 'phong'
	},
	MeshMatcapMaterial: {
		id: 'meshmatcap',
		name: 'matcap'
	},
	PointsMaterial: {
		id: 'points',
		name: 'points'
	},
	LineDashedMaterial: {
		id: 'dashed',
		name: 'linedashed'
	},
	MeshDepthMaterial: {
		id: 'depth',
		name: 'depth'
	},
	MeshNormalMaterial: {
		id: 'normal',
		name: 'normal'
	},
	MeshDistanceMaterial: {
		id: 'distanceRGBA',
		name: 'distanceRGBA'
	},
	SpriteMaterial: {
		id: 'sprite',
		name: 'sprite'
	}
};

// Aliases for shorter code hints

const aliases = {
	lightsBegin: '?#include <lights_fragment_maps>',
	lightsEnd: '?#include <aomap_fragment>',
	colorBegin: '?#include <logdepthbuf_fragment>',
	colorEnd: '?#include <tonemapping_fragment>',
	transformBegin: '?#include <morphtarget_vertex>',
	transformEnd: '?#include <project_vertex>'
};

// Converts properties to constant definition

const uniformFlags = {
	alphaTest: {
		as: 'ALPHATEST',
		not: 0
	}
};

// Set of required uniforms ( which aren't null or zero )

const uniforms = {
	opacity: { value: 1.0 },
	specular: { value: new Color( 0x111111 ) }
};

const requiredUniforms = {
	points: UniformsLib.points,
	sprite: UniformsLib.sprite,
	dashed: {
		scale: { value: 1 },
		dashSize: { value: 1 },
		totalSize: { value: 2 }
	},
	normal: {
		opacity: uniforms.opacity
	},
	toon: {
		specular: uniforms.specular,
		shininess: { value: 30 }
	},
	standard: {
		shininess: { value: 30 },
		roughness: { value: 1.0 },
		metalness: { value: 0.0 },
		envMapIntensity: { value: 1 } // temporary
	},
	physical: {
		shininess: { value: 30 },
		roughness: { value: 1.0 },
		metalness: { value: 0.0 },
		envMapIntensity: { value: 1 } // temporary
	},
	phong: {
		specular: uniforms.specular,
		shininess: { value: 30 }
	},
	cube: {
		opacity: uniforms.opacity
	},
	distanceRGBA: {
		nearDistance: { value: 1 },
		farDistance: { value: 1000 }
	},
	shadow: {
		opacity: uniforms.opacity
	}
};

// Constant definitions for which maps are used

const mapFlags = {
	map: 'USE_MAP',
	aoMap: 'USE_AOMAP',
	envMap: 'USE_ENVMAP',
	bumpMap: 'USE_BUMPMAP',
	normalMap: 'USE_NORMALMAP',
	lightMap: 'USE_LIGHTMAP',
	emissiveMap: 'USE_EMISSIVEMAP',
	specularMap: 'USE_SPECULARMAP',
	roughnessMap: 'USE_ROUGHNESSMAP',
	metalnessMap: 'USE_METALNESSMAP',
	alphaMap: 'USE_ALPHAMAP',
	displacementMap: 'USE_DISPLACEMENTMAP'
};


function useUniformPairs( instance, uniforms ) {

	// Only pairs with initial values other than null or zero needed

	if ( !instance ) return;

	if ( instance.envMap )
		cloneUniforms( UniformsLib.envmap, uniforms );

	if ( instance.aoMap )
		cloneUniforms( UniformsLib.aomap, uniforms );

	if ( instance.lightMap )
		cloneUniforms( UniformsLib.lightmap, uniforms );

	if ( instance.bumpMap )
		cloneUniforms( UniformsLib.bumpmap, uniforms );

	if ( instance.normalMap )
		cloneUniforms( UniformsLib.normalmap, uniforms );

	if ( instance.displacementMap )
		cloneUniforms( UniformsLib.displacementmap, uniforms );

	if ( instance.clearcoatNormalMap )
		cloneUniforms( UniformsLib.clearcoatnormalmap, uniforms );


}

function useUniforms( name, object, uniforms ) {

	useUniformPairs( object.uniforms, uniforms );

	if ( object.common !== false )
		cloneUniforms( UniformsLib.common, uniforms );

	if ( requiredUniforms[ name ] !== undefined )
		cloneUniforms( requiredUniforms[ name ], uniforms );

	const fog = object.fog || ( object.material ? object.material.fog || object.material.useFog : null );
	const lights = object.lights || ( object.material ? object.material.lights : null );

	if ( fog )
		cloneUniforms( UniformsLib.fog, uniforms );

	if ( lights ) {

		if ( object.use ) {

			const use = object.use;
			const shared = use.indexOf( 'sharedLights' ) > -1;
			const shadows = use.indexOf( 'shadows' ) > -1;

			if ( use.indexOf( 'PointLight' ) > -1 ) {

				cloneUniforms( UniformsLib.lights.pointLights, uniforms );

				if ( shadows ) {

					cloneUniforms( UniformsLib.pointLightShadows, uniforms );
					cloneUniforms( UniformsLib.pointShadowMap, uniforms );
					cloneUniforms( UniformsLib.pointShadowMatrix, uniforms );

				}

			}

			if ( use.indexOf( 'SpotLight' ) > -1 ) {

				cloneUniforms( UniformsLib.lights.spotLights, uniforms );

				if ( shadows ) {

					cloneUniforms( UniformsLib.spotLightShadows, uniforms );
					cloneUniforms( UniformsLib.spotShadowMap, uniforms );
					cloneUniforms( UniformsLib.spotShadowMatrix, uniforms );

				}

			}

			if ( use.indexOf( 'DirectionalLight' ) > -1 ) {

				cloneUniforms( UniformsLib.lights.directionalLights, uniforms );

				if ( shadows ) {

					cloneUniforms( UniformsLib.directionalLightShadows, uniforms );
					cloneUniforms( UniformsLib.directionalShadowMap, uniforms );
					cloneUniforms( UniformsLib.directionalShadowMatrix, uniforms );

				}

			}

			if ( use.indexOf( 'LightProbe' ) > -1 )
				cloneUniforms( UniformsLib.lights.lightProbe, uniforms );

			if ( use.indexOf( 'AmbientLight' ) > -1 )
				cloneUniforms( UniformsLib.lights.ambientLightColor, uniforms );

			if ( use.indexOf( 'ReactAreaLight' ) > -1 )
				cloneUniforms( UniformsLib.lights.rectAreaLights, uniforms );

			if ( use.indexOf( 'HemisphereLight' ) > -1 )
				cloneUniforms( UniformsLib.lights.hemisphereLights, uniforms );

		} else {

			cloneUniforms( sharedLightsUniforms, uniforms );

		}


	}

	return uniforms;

}

function cloneUniform( src, dst ) {


	dst = dst || {};

	for ( let key in src ) {


		const property = src[ key ];

		if ( property && ( property.isColor ||
			property.isMatrix3 || property.isMatrix4 ||
			property.isVector2 || property.isVector3 || property.isVector4 ||
			property.isTexture ) ) {

			dst[ key ] = property.clone();

		} else if ( Array.isArray( property ) ) {

			dst[ key ] = property.slice();

		} else {

			dst[ key ] = property;

		}

	}

	return dst;

}

function makeUniform( value ) {

	return value && value.value !== undefined ? value : { value: value };

}


function cloneUniforms( src, dst, notNull = false, share = false, mix = false, link = false ) {

	dst = dst || {};

	for ( let u in src ) {

		const uniform = src[ u ];

		if ( !uniform ) continue;

		if ( notNull ) {

			// Uniforms with null are skipped

			if ( uniform.value === null || uniform.value === 0 )
				continue;

			// Their parameters then too
		}

		if ( uniform.shared || ( uniform.linked && link ) ) {

			dst[ u ] = uniform;

		} else {

			dst[ u ] = cloneUniform( uniform );

			if ( share === true )
				dst[ u ].shared = true;

			if ( mix === true )
				dst[ u ].mixed = true;
		}

	}

	return dst;

}

function applyPatches( chunk, map ) {

	for ( let name in map ) {

		const value = map[ name ];

		if ( aliases[ name ] !== undefined )
			name = aliases[ name ];


		if ( value instanceof Object ) {

			if ( ShaderChunk[ name ] === undefined ) {

				console.error( 'ShaderMaterial.extend: ShaderChunk "%s" not found', name );

			} else {

				chunk = chunk.replace( '#include <' + name + '>', applyPatches( ShaderChunk[ name ], value ) );

			}

		} else {


			if ( name[ 0 ] === '@' ) {

				// Replace

				const line = name.substr( 1 );

				chunk = chunk.replace( line, value );

			} else if ( name[ 0 ] === '?' ) {

				// Insert before

				const line = name.substr( 1 );

				chunk = chunk.replace( line, value + '\n' + line );

			} else {

				// Insert after

				if ( !chunk ) {

					console.error( "THREE.patchShader: chunk not found '%s'", name );

				} else {

					chunk = chunk.replace( name, name + '\n' + value );

				}

			}

		}

	}

	return chunk;

}

function applyConstants( name, uniform, defines, object, instance ) {


	// Uniforms that exist but are derived from the material instance internally

	if ( uniform && uniform.value && localsMapping[ name ] !== undefined )
		instance[ name ] = uniform.value;


	// Maps require USE_X constants

	if ( mapFlags[ name ] !== undefined && uniform && uniform.value !== undefined ) {


		// Expose uniform to be detected

		instance[ name ] = uniform.value;

	}


	// Converts properties like alphaTest to their constant

	const flag = uniformFlags[ name ];

	if ( flag !== undefined && ( flag.not === undefined || flag.not !== value ) )
		defines[ flag.as ] = uniform.value;


}

// applyUniforms: Adds or overrides src uniforms to dst

function applyUniforms( instance, src, dst, defines ) {

	if ( !src.uniforms || !dst )
		return;

	for ( let name in src.uniforms ) {

		if ( !dst.uniforms[ name ] )
			dst.uniforms[ name ] = {};


		// Accepts uniform objects and plain values

		let uniform = makeUniform( src.uniforms[ name ] );

		if ( defines && applyConstants( name, uniform, defines, src, instance ) === false ) continue;

		dst.uniforms[ name ] = uniform;


	}
}

// mixUniforms: Only adds new uniforms which are declared as mixed

function mixUniforms( src, dst, defines ) {

	// Only mixed uniforms are passed to dst, only if they not exist

	if ( !src.uniforms )
		return;

	for ( let name in src.uniforms ) {

		let uniform = src.uniforms[ name ];

		if ( !uniform ) continue;

		uniform = makeUniform( uniform );


		if ( uniform.mixed && dst.uniforms[ name ] === undefined ) {

			dst.uniforms[ name ] = uniform.shared ? uniform : cloneUniform( uniform );

			if ( defines ) applyConstants( name, uniform, defines, src );

		}


	}


}


function mapUniforms( name, uniforms, object ) {

	if ( object.explicit === false ) {

		// Use all possible uniforms

		return cloneUniforms( THREE.ShaderLib[ name ].uniforms, uniforms );

	} else {

		// Only use declared and necessary

		return useUniforms( name, object, uniforms ); // cloneUniforms( THREE.ShaderLib[ name ].uniforms, uniforms, true );

	}


}

function mapShader( name, type ) {

	const mapping = mappings[ name ];

	return ShaderChunk[ mapping.id + '_' + ( type === 'vertex' ? 'vert' : 'frag' ) ];

}

function patchShader( shader, object, uniformsMixer = applyUniforms, defines = null ) {

	// A shared header ( varyings, uniforms, functions etc )

	let header = ( object.header || '' ) + '\n';
	let vertexShader = ( object.vertexHeader || '' ) + '\n' + shader.vertexShader;
	let fragmentShader = ( object.fragmentHeader || '' ) + '\n' + shader.fragmentShader;

	if ( object.vertexEnd )
		vertexShader = vertexShader.replace( /\}(?=[^.]*$)/g, object.vertexEnd + '\n}' );

	if ( object.fragmentEnd )
		fragmentShader = fragmentShader.replace( /\}(?=[^.]*$)/g, object.fragmentEnd + '\n}' );

	// Insert or replace lines (@ to replace)

	if ( object.vertex !== undefined )
		vertexShader = applyPatches( vertexShader, object.vertex );


	if ( object.fragment !== undefined )
		fragmentShader = applyPatches( fragmentShader, object.fragment );


	shader.vertexShader = header + vertexShader;
	shader.fragmentShader = header + fragmentShader;


	if ( uniformsMixer instanceof Function )
		uniformsMixer( object, shader, defines );


	return shader;

}


sharedLightsUniforms = cloneUniforms( UniformsLib.lights, {}, false, true );


if ( Object.isExtensible( THREE ) ) {

	THREE.cloneUniforms = cloneUniforms;
	THREE.cloneUniform = cloneUniform;
	THREE.patchShader = patchShader;
	THREE.mapShader = mapShader;
	THREE.extendMaterial = extendMaterial;
	THREE.CustomMaterial = CustomMaterial;

}

export {
	CustomMaterial,

	patchShader,
	extendMaterial,
	cloneUniforms,
	cloneUniform,
	mapShader
};

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
import matcap1 from "../chemical_carpaint_blue.png";
import matcap2 from "../clay_alien.png";
import matcap3 from "../metal_copper_flamed.png";
import {mergeBufferGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js"

let matcaps = [matcap, matcap1, matcap2, matcap3]
matcaps = matcaps.map((m) => new THREE.TextureLoader().load(m))
console.log(matcaps)
// require("./extend");

// import font from '../font.json'
// console.log(font)

const FONTS = [
  '/font.json',
  '/font0.json',
  '/font1.json',
  '/font2.json',
]

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
    // this.renderer.setClearColor(0x111111, 1);
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
    this.time = 0;


    this.isPlaying = true;
    this.settings();
    this.addObjects();
    this.resize();
    this.render();
    this.setupResize();
    this.addLights();
    
  }

  settings() {
    let that = this;
    this.settings = {
      text: 'impossible,impossible,',
      fontSize: 0.8,
      rotateSpeed: 1.,
      twistSpeed: 1.,
      fontDepth: 0.8,
      radius: 1.5,
      twists: 1,
      visual: 0,
      font: 0,
    };
    this.gui = new GUI();

    // this.gui.add(this.settings, "time", 0, 550, 0.01).onChange(()=>{
    //   this.material1.uniforms.time.value = this.settings.time
    //   this.material.uniforms.time.value = this.settings.time
    // });
    
    this.gui.add(this.settings, "text", ).onChange(()=>{
      this.updateGeometry()
    });
    this.gui.add(this.settings, "fontSize", 0, 1, 0.01).onChange(()=>{
      this.updateGeometry()
    });
    this.gui.add(this.settings, "fontDepth", 0, 1, 0.01).onChange(()=>{
      this.updateGeometry()
    });

    this.gui.add(this.settings, "radius", 1, 4, 0.01).onChange(()=>{
      this.material.uniforms.uRadius.value = this.settings.radius
    });
    this.gui.add(this.settings, "rotateSpeed",0,1,0.01 ).onChange(()=>{
      this.material.uniforms.uRotateSpeed.value = this.settings.rotateSpeed
    });

    

    this.gui.add(this.settings, "visual", 0, 3, 1).onChange(()=>{
      // update different matcaps
      this.material.uniforms.matcap.value = matcaps[this.settings.visual]
    });
    this.gui.add(this.settings, "font", 0, 3, 1).onChange(()=>{
      this.updateGeometry()
    });
    this.gui.add(this.settings, "twists", 0, 3, 1).onChange(()=>{
      this.material.uniforms.uTwists.value = this.settings.twists
    });
    this.gui.add(this.settings, "twistSpeed",0,10,0.01 ).onChange(()=>{
      this.material.uniforms.uTwistSpeed.value = this.settings.twistSpeed
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

  updateGeometry(){
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
      
      // this.geo1.center();

      if (this.material.uniforms) {
        this.material.uniforms.uMin.value = this.geo.boundingBox.min;
        this.material.uniforms.uMax.value = this.geo.boundingBox.max;
      }

      this.textmesh.geometry = this.geo;
    })
  }

  getMaterial(){
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
        uOffset: { value: 0. },
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

    this.material = this.getMaterial()


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
      }

      this.textmesh = new THREE.Mesh(this.geo, this.material);

      let dd = THREE.extendMaterial(THREE.MeshDepthMaterial, {
        template: this.material,
      });

      this.textmesh.castShadow = this.textmesh.receiveShadow = true;
      this.textmesh.customDepthMaterial = dd;

      this.group.add(this.textmesh);
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
    // this.scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(0, 1, 0); // ~60º
    this.scene.add(light2);
    // this.scene1.add(light22);
    // console.log(light2);

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
    }

    


    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.render.bind(this));
  }
}

new Sketch({
  dom: document.getElementById("container"),
});
