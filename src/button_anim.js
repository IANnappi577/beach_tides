// define the script to swap the text and colour of the button
// when it is clicked

// This was put into a seperate JS file to separate it from the webGL scripts

// boolean to track whether the button is "on" (anim running) or "off" (anim stopped)
let on = true;

function flip_button() {
    let button = document.getElementById("button");
    
    if(on == true) {
        button.innerHTML = "Start Animation &#9658";
        button.style.backgroundColor = "rgba(255,255,255,0.4)";
        on = false;
        // make the animation stop in main.js
        stop_anim();
    } else {
        button.innerHTML = "Stop Animation &#x23f8";
        button.style.backgroundColor = "rgba(255,255,255,0.7)";
        on = true;
        // make the animation start again in main.js
        start_anim();
    }
    
}