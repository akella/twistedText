uniform vec2 uMin;
uniform vec2 uMax;
uniform float time;
varying vec2 vUv;
varying vec3 vPosition;
varying float vDebug;
uniform vec2 pixels;
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
float map(float value, float min1, float max1, float min2, float max2) {
  // return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  return clamp( min2 + (value - min1) * (max2 - min2) / (max1 - min1), min2, max2 );
}
void main() {
  vUv = uv;
  vec3 pos = position;

  

  float radius = 2.;
  float x = map(pos.x, uMin.x, uMax.x, .0, 1.0);

  // twist
  vec2 rotyz = rotate(pos, vec3(1.,0.,0.), PI*x + time*0.1).yz;
  vec3 twisted = vec3(pos.x, rotyz.x, rotyz.y);
  pos = twisted;


  float theta = x*PI*2. ;
  vec3 dir = vec3(sin(theta), cos(theta),pos.z);
  vec3 circled = vec3(dir.xy*radius,pos.z) + 2.*vec3(pos.y*dir.x,pos.y*dir.y,0.);


  





  gl_Position = projectionMatrix * modelViewMatrix * vec4( circled, 1.0 );
}