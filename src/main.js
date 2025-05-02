"use strict";

var gl;
var canvas;
var program;

// keep a global boolean to start/stop the animation (in button_anim.js)
let running = true;

// basic colour properties (vColor in the vertex shader)
let colourLoc;

// number of vertices for each object
let n_planeverts = 6;  // a plane will have 3 vertices per triangle for 2 triangles
let n_rockverts = 66;

// position & normal, plus lookAt and perspective matrices
let vPosition, vNormal, modelView, projection;

// camera properties
let FOV = 30.0;
let aspect;
let near = 0.1;
let far = 15.0;

// animation properties
let tide_speed = 0.00005; // this is the amount to move y up/down per frame
// keep a timer counting frames, to "bounce back" the tide after a certain time
let frame_cnt = 0;
const MAX_FRAMES = 350;  // the max frames before we 'bounce back' the tide

// -- OBJECTS --

// -- Background sky plane --
// (acts as the sky and will change colour 
// with the light). It will NOT have normals or
// interact with the lighting
let background_verts = [
    vec4(1.0, -1.0, -1.0, 1.0),
    vec4(1.0,  2.0, -1.0, 1.0),
    vec4(-2.0,  2.0, 1.0, 1.0),
    vec4(1.0, -1.0, -1.0, 1.0),
    vec4(-2.0,  2.0, 1.0, 1.0),
    vec4(-2.0, -1.0, 1.0, 1.0)
];

// -- Sand plane --
let plane_verts = [
    vec4(1.5, 0.005, 0.9, 1.0),
    vec4(-0.5, -0.01, 0.9, 1.0),
    vec4(-0.5, -0.01, -0.9, 1.0),
    vec4(1.5, 0.005, -0.9, 1.0),
]
let plane_points = [];
let plane_normals = [];

// -- Water plane --
let water_verts = [
    vec4(0.9, 0.005, 0.9, 1.0),
    vec4(-2.0, 0, 0.9, 1.0),
    vec4(-2.0, 0, -0.9, 1.0),
    vec4(0.9, 0.005, -0.9, 1.0),
]
let water_points = [];
let water_normals = [];

// Helper function to build a plane from triangles (water or sand).
// the option specifies whether this is the water plane (1) or the sand plane (0)
function build_plane(a, b, c, d, verts, array, normals, option) {
    // calculate normals
    var t1 = subtract(verts[b], verts[a]);
    var t2 = subtract(verts[c], verts[b]);
    var normal = cross(t1, t2);
    normal = vec3(normal);

    // triangle 1
    array.push(verts[a]);
    normals.push(normal);
    array.push(verts[b]);
    normals.push(normal);
    array.push(verts[c]);
    normals.push(normal);

    // triangle 2
    array.push(verts[a]);
    normals.push(normal);
    array.push(verts[c]);
    normals.push(normal);
    array.push(verts[d]);
    normals.push(normal);

    if(option==0) {
        // add the texture variables for the sand
        plane_texture_points.push(texCoord[1]); // 1,0,3
        plane_texture_points.push(texCoord[0]);
        plane_texture_points.push(texCoord[3]);

        plane_texture_points.push(texCoord[1]); // 1,3,2
        plane_texture_points.push(texCoord[3]);
        plane_texture_points.push(texCoord[2]);
    } else {
		// add the texture variables for the water
		water_texture_points.push(w_texCoord[1]); // 1,0,3
        water_texture_points.push(w_texCoord[0]);
        water_texture_points.push(w_texCoord[3]);

        water_texture_points.push(w_texCoord[1]); // 1,3,2
        water_texture_points.push(w_texCoord[3]);
        water_texture_points.push(w_texCoord[2]);
	}
}

// -- the main rock model --
// This model was created manually with the aid of 
// a 3D plotter: https://www.geogebra.org/3d
let rock_verts = [
    vec4(-0.05, 0.1, 0.05, 1), // A
    vec4(-0.07, 0, 0.12, 1), // B
    vec4(-0.12, 0, 0, 1), // C
    vec4(0, 0, -0.1, 1), // D
    vec4(0.09, 0, -0.07, 1), // E
    vec4(0.09, 0, 0.05, 1), // F
    vec4(0, 0.15, 0.1, 1), // G
    vec4(0, 0.1, -0.16, 1), // H
    vec4(0.13, 0.12, -0.01, 1), // I
    vec4(0, 0.2, 0, 1), // J
    vec4(0.07, 0.09, 0.07, 1), // K
    vec4(-0.06, 0.17, -0.08, 1), // L
    vec4(0.03, 0.16, -0.05, 1), // M
];
let rock_points = [];
let rock_normals = [];

// Helper function to translate the rock vertices slightly downward
// so they make contact with the sand plane
function translate_rock(verts) {
	verts.forEach(function(vert) {
		vert[1] -= 0.01;
	});
}

// Helper function to build a triangle from 3 points.
// Used in the next function below
function build_triangle(a, b, c) {
    // calculate normals
    var t1 = subtract(rock_verts[b], rock_verts[a]);
    var t2 = subtract(rock_verts[c], rock_verts[b]);
    var normal = cross(t1, t2);
    normal = vec3(normal);

    rock_points.push(rock_verts[a]);
    rock_normals.push(normal);
    rock_points.push(rock_verts[b]);
    rock_normals.push(normal);
    rock_points.push(rock_verts[c]);
    rock_normals.push(normal);
}

// Helper function to build the rock (a series of 22 triangles) from
// the vertices in rock_verts and the build_triangle() function
function build_rock() {
    build_triangle(1,2,0); build_triangle(6,1,0); build_triangle(3,2,5); // BCA, GBA, DCF
    build_triangle(7,3,4); build_triangle(8,4,5); build_triangle(3,4,5); // HDE, IEF, DEF
    build_triangle(7,4,8); build_triangle(7,12,8); build_triangle(12,11,7); // HEI, HMI, MLH
    build_triangle(11,3,7); build_triangle(10,6,1); build_triangle(1,5,10); // LDH, KGB, BFK
    build_triangle(5,1,2); build_triangle(11,2,3); build_triangle(0,11,2); // FBC, LCD, ALC
    build_triangle(8,10,5); build_triangle(12,10,8); build_triangle(9,6,0); // IKF, MKI, JGA
    build_triangle(9,11,0); build_triangle(9,6,10); build_triangle(9,12,10); // JLA, JGK, JMK
    build_triangle(9,10,12); // JKM
}


// -- LIGHTING --

// products for the ambient, diffuse, and specular matrices
let ambientProduct, diffuseProduct, specularProduct;

// Loc JS variables associated with the vertex shader variables
let lightPosLoc, ambientLoc, diffuseLoc, specularLoc, shininess, alphaLoc, useLightingLoc;

// set a boolean to keep track of whether the light is "turned off" when it
// dips below the horizon.
let sun_off = false;

// -- Lighting Properties --
let lightPosition = vec4(-10.0, 10.0, 1.0, 0.0);
let lightAmbient  = vec4(0.75, 0.65, 0.55, 1.0);
let lightDiffuse  = vec4(0.7, 0.7, 0.7, 1.0);
let lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

// -- Lighting by material --

// Sand Lighting
let sandAmbient  = vec4(1.0, 0.85, 0.3, 1.0);
let sandDiffuse  = vec4(1.0, 1.0, 1.0, 1.0);
let sandSpecular = vec4(0.0, 0.0, 0.0, 1.0);
let sandShininess = 5.0;

// Rock Lighting
let rockAmbient  = [0.8, 0.8, 0.8, 1.0];
let rockDiffuse  = [1.0, 1.0, 1.0, 1.0];
let rockSpecular = vec4(0.0, 0.0, 0.0, 1.0);
let rockShininess = 5.0;

// Water Lighting
let waterAmbient  = vec4(0.1, 0.1, 0.3, 1.0);
let waterDiffuse  = vec4(0.2, 0.4, 0.8, 1.0);
let waterSpecular = vec4(1.0, 1.0, 1.0, 1.0);
let waterShininess = 100.0;
// as an extra for water, we need to keep an alpha (transparency) value to 
// pass to fColor.a in the vertex shader
let waterAlpha = 0.8;

// set the number of frames it will take to totally fade the rock to black (turned off "sun")
const max_ticks = 60;

// calculate the "tick" values to move the lighting to 0 over
const ambient_tick = [0.6/max_ticks, 0.6/max_ticks, 0.6/max_ticks];
const diffuse_tick = [0.8/max_ticks, 0.8/max_ticks, 0.8/max_ticks];
// we don't need to change the specular because it is already 0

// keep track of the current light settings
let currAmbient  = [rockAmbient[0], rockAmbient[1], rockAmbient[2], 1.0];
let currDiffuse  = [rockDiffuse[0], rockDiffuse[1], rockDiffuse[2], 1.0];

// helper function to fade the light on the rock when it goes below the horizon
function fade_rock(y) {
    // if the light moves below the horizon, slowly "turn off the sun" by 
    // changing the lighting properties for ONLY FOR THE ROCK
    if(sun_off && y < 4.0 && currAmbient[0] > 0.2) {
        // shift the rock colour by 1 tick
        rockAmbient  = [currAmbient[0]-ambient_tick[0], currAmbient[1]-ambient_tick[1], currAmbient[2]-ambient_tick[2], 1.0];
        rockDiffuse  = [currDiffuse[0]-diffuse_tick[0], currDiffuse[1]-diffuse_tick[1], currDiffuse[2]-diffuse_tick[2], 1.0];
        currAmbient = rockAmbient;
        currDiffuse = rockDiffuse;
    } else if (!sun_off && currAmbient[0] < 0.82) {
        rockAmbient  = [currAmbient[0]+ambient_tick[0], currAmbient[1]+ambient_tick[1], currAmbient[2]+ambient_tick[2], 1.0];
        rockDiffuse  = [currDiffuse[0]+diffuse_tick[0], currDiffuse[1]+diffuse_tick[1], currDiffuse[2]+diffuse_tick[2], 1.0];
        currAmbient = rockAmbient;
        currDiffuse = rockDiffuse;
    }
}

// -- ANIMATION --

// Set up the light movement theta and radius properties to form an arc
let radius = 15.0;
// set the beginning theta as the angle from 0 to the x,y point (10, -10)
// (arctan for JS uses the syntax atan2(y, x))
let theta = Math.atan2(-10, 10);

// helper function that moves the vertices for the water plane
// up per frame before redrawing
function move_tide_up() {
    // move the water up by the tide speed
    water_verts[0][1] += tide_speed;
    water_verts[1][1] += tide_speed;
    water_verts[2][1] += tide_speed;
    water_verts[3][1] += tide_speed;

    // move the water toward the camera (along x axis)
    water_verts[0][0] += tide_speed * 10;
    water_verts[1][0] += tide_speed * 10;
    water_verts[2][0] += tide_speed * 10;
    water_verts[3][0] += tide_speed * 10;
}

// helper function that moves the vertices for the water plane down
// per frame before redrawing
function move_tide_down() {
    // move the water down by the tide speed
    water_verts[0][1] -= tide_speed;
    water_verts[1][1] -= tide_speed;
    water_verts[2][1] -= tide_speed;
    water_verts[3][1] -= tide_speed;

    // move the water away from the camera (along x axis)
    water_verts[0][0] -= tide_speed * 10;
    water_verts[1][0] -= tide_speed * 10;
    water_verts[2][0] -= tide_speed * 10;
    water_verts[3][0] -= tide_speed * 10;
}

// -- Background colour-gradient animation --

// colour gradients will be calculated using the y position of the light,
// to sync it with the light's movement. It will reach max dark blue at y = 0 and
// max bright blue at the critical height:
let crit_height = 6;

// define the direction of colour change: the sun rising, or setting
// RISING: 1, SETTING: 0
let dir = 1;

// Base colours, adjusted to be between 0 and 1:
// BLACK: #020B1A - rgb(2, 11, 26)
// SKYBLUE: #D7E1F4 - rgb(215, 225, 244)
const BLACK = [2/255, 11/255, 26/255, 1];
const SKYBLUE = [215/255, 225/255, 244/255, 1];

// Calculate "ticks", or the amount to shift each RGB value per frame,
// to smooth transition between the colours (e.g. BLK_BL is 1 tick from black -> blue).
// Based on trial and error it takes approx. 95 frames to transition between 2 colours (fpt):
const fpt = 95 * 255;
const BLK_BL = [213/fpt, 214/fpt, 218/fpt];
const BL_BLK = [-213/fpt, -214/fpt, -218/fpt];

// keep a variable for the current colour on a frame, so we can shift it 
// by a tick on the next frame
let curr = [0,0,0,1];

function move_gradient_theta(y) {

	/*
		Algorithm for choosing the colour:
			When y <= 0, make the sky only black
            When y >= 2*crit_height, make the sky only blue
			When y > 0 and y <= 2*crit_height TWO Possibilities:
        		- when bool = rising, move one "tick" from black toward blue
        		- when bool = setting, move one "tick" blue toward black

			When y = 2*crit_height, flip the direction to SETTING (0)
			When y = 0, flip the direction to RISING (1)
  	*/

	if(y <= 0) {
		curr = [BLACK[0], BLACK[1], BLACK[2], BLACK[3]];

		// flip the bool to RISING at 0 (give an error tolerance of 0.3)
		if(y > -0.3 && y < 0.3) dir = 1;

	} else if(y >= 2*crit_height) {
		curr = [SKYBLUE[0], SKYBLUE[1], SKYBLUE[2], SKYBLUE[3]];

		// flip the bool to SETTING at 2*crit_height (give an error tolerance of 0.3)
		if(y > 2*crit_height-0.3 && y < 2*crit_height+0.3) dir = 0;

	} else if (y > 0 && y < 2*crit_height) {
		// based on whether we are rising or setting, shift the gradient by a tick
		if(dir == 1) {
			curr = [curr[0]+BLK_BL[0], curr[1]+BLK_BL[1], curr[2]+BLK_BL[2], 1];
		} else {
			curr = [curr[0]+BL_BLK[0], curr[1]+BL_BLK[1], curr[2]+BL_BLK[2], 1];
		}

	} else {
		console.log("ypos out of range");
	}

	// update the colour based on the now current colour:
    gl.uniform4f(colourLoc, curr[0], curr[1], curr[2], 1.0);
}

// -- TEXTURES -- 

// texture variables (vTexCoord is vTexCoord in the vertex shader 
// and fTexCoord in the fragment shader)
let texture;
let w_texture;
let vTexCoord;
let s_image;
let w_image;

// sand plane texture coords
var texCoord = [
  vec2(0.0, 0.0),
  vec2(0.0, 8.0),
  vec2(8.0, 8.0),
  vec2(8.0, 0.0)
]
let plane_texture_points = [];

// water plane texture coords
var w_texCoord = [
	vec2(0.0, 0.0),
	vec2(0.0, 1.0),
	vec2(1.0, 1.0),
	vec2(1.0, 0.0)
]
let water_texture_points = [];

// Helper function for texture creation, slightly altered to handle multiple textures. Taken from the
// Chap7/textureCube1.js example. The option parameter specifies if this is the
// sand (0) or water (1) planes, so we can differentiate variables as needed.
function configureTexture( image, option ) {
	if(option == 0) {
		texture = gl.createTexture();
		gl.bindTexture( gl.TEXTURE_2D, texture );
	} else {
		w_texture = gl.createTexture();
		gl.bindTexture( gl.TEXTURE_2D, w_texture );
	}
	
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image );
	gl.generateMipmap( gl.TEXTURE_2D );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR );
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

	gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
}


// -- Main Draw Logic --

window.onload = function draw()
{
    canvas = document.getElementById("gl-canvas");

    // stretch the canvas width and height to the device settings
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // set the camera's aspect ratio as square, to be used below
    aspect = canvas.width/canvas.height;

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    // enable depth
    gl.enable(gl.DEPTH_TEST);

    // configure webgl
    gl.viewport(0, 0, canvas.width, canvas.height);

    // load shaders
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // get the locations of our shader variables
    vPosition = gl.getAttribLocation(program, "vPosition");
    vNormal = gl.getAttribLocation(program, "vNormal");
    modelView = gl.getUniformLocation(program, "modelView");
    projection = gl.getUniformLocation(program, "projection");
    colourLoc = gl.getUniformLocation(program, "vColor");
    lightPosLoc = gl.getUniformLocation(program, "lightPosition");
    ambientLoc = gl.getUniformLocation(program, "ambientProduct");
    diffuseLoc = gl.getUniformLocation(program, "diffuseProduct");
    specularLoc = gl.getUniformLocation(program, "specularProduct");
    shininess = gl.getUniformLocation(program, "shininess");
    alphaLoc = gl.getUniformLocation(program, "materialAlpha");
    vTexCoord = gl.getAttribLocation(program, "vTexCoord");
    useLightingLoc = gl.getUniformLocation(program, "use_lighting");
    
    // build the sand plane vertices
    build_plane(1, 0, 3, 2, plane_verts, plane_points, plane_normals, 0);

	// translate the rock vertices down a bit to make contact with the sand plane
	translate_rock(rock_verts);

    // build the rock
    build_rock();

	// set up the eye, at, and up for the model view matrix
    let eye = vec3(1.2, 0.05, 0.85);
    let at = vec3(0.03, 0.0, 0.1);
    let up = vec3(0.0, 1.0, 0.0);

    // create the model view matrix and send to the shader
    var modelViewMatrix = lookAt(eye, at, up);
    gl.uniformMatrix4fv( modelView, false, flatten(modelViewMatrix) );

    // use perspective() to create the projection matrix, and send to the shader
    var projectionMatrix = perspective(FOV, aspect, near, far);
    gl.uniformMatrix4fv( projection, false, flatten(projectionMatrix) );

    // set up the texture for the sand
    s_image = document.getElementById("texImage");
    configureTexture( s_image, 0 );

	// set up the texture for the water
	w_image = document.getElementById("texWaterImage");
	configureTexture( w_image, 1 );

    render();
}

// renders the GPU buffer to the display
function render()
{
    // clear the color and depth buffer bit
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // -- Lighting position & animation --

    // The start position of the light is in lightPosition, and each subsequent frame
    // moves theta 0.01 degrees 
    gl.uniform4fv(lightPosLoc, flatten(lightPosition));
    // calculate the next theta
    theta += 0.01;
    // save the y position to be used in the colour gradient animation later
	let y_pos = radius*Math.sin(theta); 
    lightPosition = vec4( radius*Math.cos(theta), y_pos, 1.0, 0.0 );

    // if the sun goes below the horizon, fade the lighting properties
    // for the rock
    if(y_pos < 4.0) sun_off = true;
    else sun_off = false;
    fade_rock(y_pos);

    // -- Draw the objects --

    // -- Buffer for the background false "sky":
    // Send the vertices for the background plane
    let bg_buffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, bg_buffer );
    gl.bufferData(gl.ARRAY_BUFFER, flatten(background_verts), gl.STATIC_DRAW);
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );
    
    // set the colour for the background and then draw the plane:
    
    // turn off the normal calculations for this plane
    gl.uniform1f(useLightingLoc, 0.0);
    // change the background colour based on y position
    move_gradient_theta(y_pos);
    // ensure the opacity is set at 100%, and draw the vertices
    gl.uniform1f(alphaLoc, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, n_planeverts);

    // turn back on the normal calculations
    gl.uniform1f(useLightingLoc, 1.0);

    // -- Buffer for the sand --
    // calculate the material lighting for the sand, and send these to the vertex shader:
    ambientProduct = mult(lightAmbient, sandAmbient);
    diffuseProduct = mult(lightDiffuse, sandDiffuse);
    specularProduct = mult(lightSpecular, sandSpecular);
    gl.uniform4fv(ambientLoc, flatten(ambientProduct));
    gl.uniform4fv(diffuseLoc, flatten(diffuseProduct) );
    gl.uniform4fv(specularLoc, flatten(specularProduct) );
    gl.uniform1f(shininess, sandShininess);
    gl.uniform1f(alphaLoc, 1.0);

    // Send the vertices for the sand plane
    let sand_buffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, sand_buffer );
    gl.bufferData(gl.ARRAY_BUFFER, flatten(plane_points), gl.STATIC_DRAW);
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Send data for the sand plane normals
    let sandNormals = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, sandNormals );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(plane_normals), gl.STATIC_DRAW );
    gl.vertexAttribPointer( vNormal, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal );

    // create a buffer for the sand texture
    var tBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, tBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(plane_texture_points), gl.STATIC_DRAW );
    gl.vertexAttribPointer( vTexCoord, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vTexCoord );

    // bind the sand texture
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, texture );
    gl.uniform1i(gl.getUniformLocation( program, "texture"), 0);

    // set the colour for the sand and then draw the plane
    gl.uniform4f(colourLoc, 0.9, 0.8, 0.5, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, n_planeverts);

    // Since we are done with the sand texture, disable the buffer
    gl.disableVertexAttribArray(vTexCoord);

    // -- Buffer for the rock --
    // calculate the material lighting for the rock, and send these to the vertex shader:
    // since the fade_rock() function uses arrays and not vec4, swap to vec4 before multiplying:
    let temp_rockamb = vec4(rockAmbient[0], rockAmbient[1], rockAmbient[2], 1.0);
    let temp_rockdif = vec4(rockDiffuse[0], rockDiffuse[1], rockDiffuse[2], 1.0);
    ambientProduct = mult(lightAmbient, temp_rockamb);
    diffuseProduct = mult(lightDiffuse, temp_rockdif);
    specularProduct = mult(lightSpecular, rockSpecular);
    gl.uniform4fv(ambientLoc, flatten(ambientProduct));
    gl.uniform4fv(diffuseLoc, flatten(diffuseProduct));
    gl.uniform4fv(specularLoc, flatten(specularProduct));
    gl.uniform1f(shininess, rockShininess);

    // Send the vertices for the rock
    let rock_buffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, rock_buffer );
    gl.bufferData(gl.ARRAY_BUFFER, flatten(rock_points), gl.STATIC_DRAW);
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // create, bind buffer, and send data for the rock normals
    let rockNormals = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, rockNormals );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(rock_normals), gl.STATIC_DRAW );
    gl.vertexAttribPointer( vNormal, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal );

    // change the color for the vertices for the rock and draw the plane
    gl.uniform4f(colourLoc, 0.0, 0.0, 0.0, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, n_rockverts);

    // -- Buffer for the water --
    // rebuild the water coordinates per frame, because the coords will change:
    // the tide will move up, until the max frame count has been reached, then it will go back down
    if(frame_cnt <= MAX_FRAMES) {
        move_tide_up();
        frame_cnt++;
    } else if (frame_cnt > MAX_FRAMES && frame_cnt < MAX_FRAMES*2) {
        move_tide_down();
        frame_cnt++;
    } else if (frame_cnt == MAX_FRAMES*2) {
        frame_cnt = 0;
    }

    build_plane(1, 0, 3, 2, water_verts, water_points, water_normals, 1);
    
    // calculate the material lighting for the water, and send these to the vertex shader:
    ambientProduct = mult(lightAmbient, waterAmbient);
    diffuseProduct = mult(lightDiffuse, waterDiffuse);
    specularProduct = mult(lightSpecular, waterSpecular);
    gl.uniform4fv(ambientLoc, flatten(ambientProduct));
    gl.uniform4fv(diffuseLoc, flatten(diffuseProduct) );
    gl.uniform4fv(specularLoc, flatten(specularProduct) );
    gl.uniform1f(shininess, waterShininess);
    // set the semi-transparent opacity of the water 
    gl.uniform1f(alphaLoc, waterAlpha);

    // Send the vertices for the water plane
    let water_buffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, water_buffer );
    gl.bufferData(gl.ARRAY_BUFFER, flatten(water_points), gl.STATIC_DRAW);
    gl.vertexAttribPointer( vPosition, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );

    // Send data for the water plane normals
    let waterNormals = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, waterNormals );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(water_normals), gl.STATIC_DRAW );
    gl.vertexAttribPointer( vNormal, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal );

	// create a buffer for the water texture
    var wtBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, wtBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(water_texture_points), gl.STATIC_DRAW );
    gl.vertexAttribPointer( vTexCoord, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vTexCoord );

    // bind the water texture
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, w_texture );
    gl.uniform1i(gl.getUniformLocation( program, "texture"), 0);

    // Change the color for the vertices for the water and draw the plane.
	// Make it blended for a water-y effect (found in Chap7/cubet.js)
    gl.uniform4f(colourLoc, 0.0, 0.0, 0.0, 0.6);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, n_planeverts);

    // disable blend mode, since we are done drawing the water
    gl.disable(gl.BLEND);

	// Since we are done with the water texture, disable the buffer
    gl.disableVertexAttribArray(vTexCoord);

    // only call render again if the animation is running:
    if(running) {
        // set a 60 fps frame rate (timeout = 1000 ms / 60 frames)
        setTimeout(
            function () { requestAnimationFrame(render); }, (1000/60)
        );
    }
}

// Two little helper functions to toggle the animation on and off:
function stop_anim() {
    running = false;
}
function start_anim() {
    running = true;
    render();
}