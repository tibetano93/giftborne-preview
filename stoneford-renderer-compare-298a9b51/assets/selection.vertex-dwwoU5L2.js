import{t as e}from"./shaderStore-D-XQlhUT.js";import{t}from"./bonesDeclaration-Cnk4EbdQ.js";import{t as n}from"./bonesVertex-Ds8-aNj0.js";import{t as r}from"./clipPlaneVertex-CK19-VG6.js";import{t as i}from"./clipPlaneVertexDeclaration-Y8pYqZvV.js";import{t as a}from"./morphTargetsVertex-BRp7iZIY.js";import{t as o}from"./morphTargetsVertexDeclaration-DVem6I71.js";import{t as s}from"./morphTargetsVertexGlobal-BwNubUm-.js";import{t as c}from"./morphTargetsVertexGlobalDeclaration-DmdwwXHx.js";import{n as l,t as u}from"./bakedVertexAnimation-7XIMgH6x.js";import{t as d}from"./instancesDeclaration-CJBvtBV5.js";import{t as f}from"./instancesVertex-C-FoRQR1.js";var p=`selectionVertexShader`,m=`attribute vec3 position;
#ifdef INSTANCES
attribute float instanceSelectionId;
#endif
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<clipPlaneVertexDeclaration>
#include<instancesDeclaration>
uniform mat4 viewProjection;
#ifdef STORE_CAMERASPACE_Z
uniform mat4 view;
#else
uniform vec2 depthValues;
#endif
#ifdef INSTANCES
flat varying float vSelectionId;
#endif
#ifdef STORE_CAMERASPACE_Z
varying float vViewPosZ;
#else
varying float vDepthMetric;
#endif
#ifdef ALPHATEST
varying vec2 vUV;uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
vec3 positionUpdated=position;
#ifdef UV1
vec2 uvUpdated=uv;
#endif
#ifdef UV2
vec2 uv2Updated=uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);gl_Position=viewProjection*worldPos;
#ifdef ALPHATEST
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
#ifdef STORE_CAMERASPACE_Z
vViewPosZ=(view*worldPos).z;
#else
#ifdef USE_REVERSE_DEPTHBUFFER
vDepthMetric=((-gl_Position.z+depthValues.x)/(depthValues.y));
#else
vDepthMetric=((gl_Position.z+depthValues.x)/(depthValues.y));
#endif
#endif
#ifdef INSTANCES
vSelectionId=instanceSelectionId;
#endif
#include<clipPlaneVertex>
#define CUSTOM_VERTEX_MAIN_END
}
`;e.ShadersStore[p]||(e.ShadersStore[p]=m);var h=[t,l,c,o,i,d,s,a,f,n,u,r];for(let t of h)e.IncludesShadersStore[t.name]||(e.IncludesShadersStore[t.name]=t.shader);var g={name:p,shader:m};export{g as selectionVertexShader};