var API_ENDPOINT = 'https://inputtools.google.com/request?ime=handwriting&app=autodraw&dbg=1&cs=1&oe=UTF-8';
var SVG_ENDPOINT = 'https://storage.googleapis.com/artlab-public.appspot.com/stencils/selman/';
var canvas, ctx, pressed = false, pressedAt = 0, drawingInterval = null, intervalLastPosition = [-1,-1], shapes = [], currentShape = null,
    prevX = 0,
    currX = 0,
    prevY = 0,
    currY = 0,
    highlightStartPoint = false;

var dColor = "black", dColorStartingPoint = "black", dStroke = 8;

function init() {
    canvas = document.getElementById("can");
    ctx = canvas.getContext("2d");
    w = canvas.width;
    h = canvas.height;

    canvas.addEventListener("mousemove", function (e) {
        drawXY("move", e)
    }, false);
    canvas.addEventListener("mousedown", function (e) {
        drawXY("down", e)
    }, false);
    canvas.addEventListener("mouseup", function (e) {
        drawXY("up", e)
    }, false);
    canvas.addEventListener("mouseout", function (e) {
        drawXY("out", e)
    }, false);
}

function prepareNewShape() {
    currentShape = [
        [], // x coordinates
        [], // y coordinates
        [] // times
    ]
}

function addPointToCurrentShape(x, y) {
    currentShape[0].push(x);
    currentShape[1].push(y);
    currentShape[2].push(Date.now() - pressedAt);
}

function draw() {
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.strokeStyle = dColor;
    ctx.fillStyle = dColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = dStroke;
    ctx.stroke();
    ctx.closePath();
}

function erase() {
    ctx.clearRect(0, 0, w, h);
    document.getElementById("canval").value = "";
    shapes = [];
}

function save() {
    var dataURL = canvas.toDataURL();
    document.getElementById("canval").value = dataURL;
}

function drawingShape() {
    if (intervalLastPosition[0] == prevX && intervalLastPosition[1] == prevY) {
        // do nothing
    } else {
        addPointToCurrentShape(prevX, prevY);
        intervalLastPosition = [prevX, prevY];
    }
}

function drawXY(res, e) {
    if (res == "down") {
        prevX = currX;
        prevY = currY;
        currX = e.clientX - canvas.offsetLeft;
        currY = e.clientY - canvas.offsetTop;

        pressed = true;
        pressedAt = Date.now();
        highlightStartPoint = true;
        
        prepareNewShape();
        drawingInterval = setInterval(drawingShape,9); // stores coordinates every 9ms
        
        if (highlightStartPoint) {
            ctx.beginPath();
            ctx.fillStyle = dColorStartingPoint;
            ctx.fillRect(currX, currY, 2, 2);
            ctx.closePath();
            highlightStartPoint = false;
        }
    }
    if (res == "up" || (pressed && res == "out")) {
        pressed = false;
        commitCurrentShape();			
    }
    if (res == "move") {
        if (pressed) {
            prevX = currX;
            prevY = currY;
            currX = e.clientX - canvas.offsetLeft;
            currY = e.clientY - canvas.offsetTop;
            draw();
        }
    }
}


function extractDataFromApi(data) {
    var regex = /SCORESINKS: (.*) Service_Recognize:/
    return JSON.parse(data[1][0][3].debug_info.match(regex)[1])
}


function commitCurrentShape() {
    clearInterval(drawingInterval);
    shapes.push(currentShape);
    

    var shapeDrawingTime = Date.now() - pressedAt;
    //console.log("It tooks: "+shapeDrawingTime+"ms");
    
    jQuery.ajax({
        url: API_ENDPOINT,
        type: 'POST',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        data: JSON.stringify({
            input_type: 0,
            requests: [{
                language: 'autodraw',
                writing_guide: {
                    "width": 400,
                    "height": 400
                },
                ink: shapes
            }]
        }),
        success: function(data) {
            
            if (data[0] !== 'SUCCESS') {
                throw new Error(data);
            }
            
            var results = extractDataFromApi(data);
            
            var parsedResults = results.map(function (result) {
                var escapedName = result[0].replace(/ /g, '-');
                
                return {
                    name: result[0],
                    confidence: result[1],
                    url: SVG_ENDPOINT + escapedName + '-01.svg',
                    url_variant_1: SVG_ENDPOINT + escapedName + '-02.svg',
                    url_variant_2: SVG_ENDPOINT + escapedName + '-03.svg'
                };
            });
            
            displaySuggestions(parsedResults);
        },
        error: function(response) {
            console.log(response);
        }
    });
}

function displaySuggestions(suggestions) {

    var $suggestions = jQuery('#suggestions');
    $suggestions.html('');

    //suggestions.sort(function(b,a) {return (a.confidence > b.confidence) ? 1 : ((b.confidence > a.confidence) ? -1 : 0);} );

    for (var i = 0; i < suggestions.length; i++) {
        var suggestion = suggestions[i];
        
        var $img = jQuery('<img />')
            .attr('src', suggestion.url)
            .attr('width',80)
            .attr('height',80)
            .css({
                border: '1px solid black'
            }).error(function() {
                $(this).remove();
            });

        var $detail = jQuery('<p />').text(suggestion.name);

        var $imgWrapper = jQuery('<div />').attr('style', 'width:80px;height:80px;');
        $imgWrapper.append($img);
        
        $suggestions.append($imgWrapper);
        $suggestions.append($detail);
    }
}

function pickSuggestion(src) {
    erase();
    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, 0, 0);
    }
    img.src = src;
}

jQuery(function(){
    init();
    
    jQuery(document).on('click', '#suggestions img', function() {
        pickSuggestion($(this).attr('src'));
    });
});