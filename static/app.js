const $ = id => document.getElementById(id);
const imageInput=$("imageInput"), canvas=$("resultCanvas"), ctx=canvas.getContext("2d");
const brightness=$("brightness"), contrast=$("contrast");
let sourceImage=null, baseImage=null, sourceFile=null, currentFilter="original", renderQueued=false;
let selectedVideo=null, batchFiles=[], batchObjectUrls=[], originalSourceFile=null;
const historyStates=[],redoStates=[];const historyLimit=30;
let historyBusy=false;
const adjustmentIds=["exposure","shadows","midtones","highlights","temperature","tint","saturation","grain","vignette","texture"];

function snapshotCanvas(){
  if(!baseImage||canvas.hidden)return null;
  const clone=document.createElement("canvas");
  const width=baseImage.naturalWidth||baseImage.width||canvas.width;
  const height=baseImage.naturalHeight||baseImage.height||canvas.height;
  clone.width=width;
  clone.height=height;
  clone.getContext("2d").drawImage(baseImage,0,0,width,height);
  const adjustmentValues={};
  adjustmentIds.forEach(id=>adjustmentValues[id]=$(id).value);
  return {canvas:clone,brightness:brightness.value,contrast:contrast.value,adjustments:adjustmentValues};
}
function snapshotsEqual(a,b){
  if(!a||!b||a.brightness!==b.brightness||a.contrast!==b.contrast)return false;
  if(a.adjustments&&b.adjustments){
    if(adjustmentIds.some(id=>a.adjustments[id]!==b.adjustments[id]))return false;
  }
  if(a.canvas.width!==b.canvas.width||a.canvas.height!==b.canvas.height)return false;
  return a.canvas.toDataURL()===b.canvas.toDataURL();
}
function commitHistory(){
  if(!baseImage||canvas.hidden||historyBusy)return;
  const snapshot=snapshotCanvas();
  if(!snapshot)return;
  const last=historyStates[historyStates.length-1];
  if(snapshotsEqual(last,snapshot))return;
  historyStates.push(snapshot);
  if(historyStates.length>historyLimit)historyStates.shift();
  redoStates.length=0;
  updateHistoryButtons();
}
function updateHistoryButtons(){
  $("undoButton").disabled=historyBusy||historyStates.length<2;
  $("redoButton").disabled=historyBusy||redoStates.length===0;
}
function restoreSnapshot(snapshot){
  if(!snapshot)return;
  baseImage=snapshot.canvas;
  brightness.value=snapshot.brightness;
  contrast.value=snapshot.contrast;
  if(snapshot.adjustments)adjustmentIds.forEach(id=>{$(id).value=snapshot.adjustments[id];});
  updateAdjustmentLabels();
  updateLabels();
  drawLivePreview();
  snapshot.canvas.toBlob(blob=>{
    if(blob)sourceFile=new File([blob],"history-state.png",{type:"image/png"});
  },"image/png");
}
$("undoButton").addEventListener("click",()=>{
  if(historyBusy||historyStates.length<2)return;
  historyBusy=true;updateHistoryButtons();
  const current=historyStates.pop();
  redoStates.push(current);
  restoreSnapshot(historyStates[historyStates.length-1]);
  historyBusy=false;updateHistoryButtons();
  setStatus("Undid the last edit.");
});
$("redoButton").addEventListener("click",()=>{
  if(historyBusy||redoStates.length===0)return;
  historyBusy=true;updateHistoryButtons();
  const snapshot=redoStates.pop();
  historyStates.push(snapshot);
  restoreSnapshot(snapshot);
  historyBusy=false;updateHistoryButtons();
  setStatus("Redid the edit.");
});

const savedTheme=localStorage.getItem("pixellab-theme");
if(savedTheme==="dark")document.documentElement.dataset.theme="dark";
function updateThemeButton(){
  const dark=document.documentElement.dataset.theme==="dark";
  $("themeToggle").textContent=dark?"☀":"☾";
  $("themeToggle").title=dark?"Switch to light mode":"Switch to dark mode";
}
updateThemeButton();
$("themeToggle").addEventListener("click",()=>{
  const next=document.documentElement.dataset.theme==="dark"? "light":"dark";
  if(next==="dark")document.documentElement.dataset.theme="dark";
  else delete document.documentElement.dataset.theme;
  localStorage.setItem("pixellab-theme",next);
  updateThemeButton();
});

function setStatus(text){$("previewStatus").textContent=text;}
function updateLabels(){$("brightnessValue").value=brightness.value+"%";$("contrastValue").value=contrast.value+"%";}
function updateAdjustmentLabels(){
  $("exposureValue").value=(Number($("exposure").value)/100).toFixed(1)+" EV";
  ["shadows","midtones","highlights","temperature","tint","grain","vignette","texture"].forEach(id=>{$(id+"Value").value=$(id).value});
  $("saturationValue").value=$("saturation").value+"%";
}
function fitCanvasToStage(){
  if(!baseImage)return;
  const stage=$("canvasStage");
  const availableWidth=Math.max(160,stage.clientWidth-24);
  const availableHeight=Math.min(window.innerHeight*.65,720);
  const imageWidth=baseImage.naturalWidth||baseImage.width;
  const imageHeight=baseImage.naturalHeight||baseImage.height;
  const scale=Math.min(availableWidth/imageWidth,availableHeight/imageHeight);
  const displayWidth=Math.max(1,Math.round(imageWidth*scale));
  const displayHeight=Math.max(1,Math.round(imageHeight*scale));
  canvas.style.width=`${displayWidth}px`;
  canvas.style.height=`${displayHeight}px`;
  stage.style.height=`${displayHeight+24}px`;
  stage.style.minHeight="0";
}
function drawLivePreview(){
  if(!baseImage)return;
  canvas.width=baseImage.naturalWidth||baseImage.width;
  canvas.height=baseImage.naturalHeight||baseImage.height;
  const exposureFactor=Math.pow(2,Number($("exposure").value)/100);
  const brightnessFactor=(Number(brightness.value)/100)*exposureFactor;
  ctx.filter=`brightness(${brightnessFactor}) contrast(${Number(contrast.value)/100}) saturate(${Number($("saturation").value)/100})`;
  ctx.drawImage(baseImage,0,0);
  ctx.filter="none";

  const temperature=Number($("temperature").value)/100;
  const tint=Number($("tint").value)/100;
  const shadows=Number($("shadows").value)/100;
  const midtones=Number($("midtones").value)/100;
  const highlights=Number($("highlights").value)/100;
  const grain=Number($("grain").value)/100;
  const vignette=Number($("vignette").value)/100;
  const texture=Number($("texture").value)/100;
  const needsPixels=Math.abs(temperature)+Math.abs(tint)+Math.abs(shadows)+Math.abs(midtones)+Math.abs(highlights)+grain+vignette+Math.abs(texture)>0;
  if(needsPixels){
    const imageData=ctx.getImageData(0,0,canvas.width,canvas.height);
    const data=imageData.data;
    const copy=new Uint8ClampedArray(data);
    const width=canvas.width,height=canvas.height;
    const cx=(width-1)/2,cy=(height-1)/2;
    const maxRadius=Math.sqrt(cx*cx+cy*cy)||1;
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const index=(y*width+x)*4;
        let r=data[index],g=data[index+1],b=data[index+2];

        let lum=(0.299*r+0.587*g+0.114*b)/255;
        const shadowMask=Math.pow(1-lum,2);
        const highlightMask=Math.pow(lum,2);
        const midMask=1-Math.abs(lum-.5)*2;
        const tone=(shadows*shadowMask+midtones*midMask+highlights*highlightMask)*18;
        r+=tone;g+=tone;b+=tone;

        r+=temperature*18;b-=temperature*18;
        g+=tint*10;r-=tint*4;b-=tint*4;

        if(texture!==0){
          const left=(x>0?(y*width+x-1)*4:index);
          const right=(x<width-1?(y*width+x+1)*4:index);
          const up=(y>0?((y-1)*width+x)*4:index);
          const down=(y<height-1?((y+1)*width+x)*4:index);
          const neighbor=(copy[left]+copy[right]+copy[up]+copy[down])/4;
          const detail=((copy[index]+copy[index+1]+copy[index+2])/3-neighbor)*texture*.55;
          r+=detail;g+=detail;b+=detail;
        }

        if(vignette>0){
          const dx=(x-cx)/cx,dy=(y-cy)/cy;
          const distance=Math.sqrt(dx*dx+dy*dy)/Math.SQRT2;
          const falloff=Math.max(0,distance-.55)*vignette*55;
          r-=falloff;g-=falloff;b-=falloff;
        }

        if(grain>0){
          const noise=((x*19+y*37+(x*y*13)%101)%101)/100-.5;
          const amount=grain*18;
          r+=noise*amount;g+=noise*amount;b+=noise*amount;
        }

        data[index]=Math.max(0,Math.min(255,r));
        data[index+1]=Math.max(0,Math.min(255,g));
        data[index+2]=Math.max(0,Math.min(255,b));
      }
    }
    ctx.putImageData(imageData,0,0);
  }
  $("dimensions").textContent=`${canvas.width} × ${canvas.height}`;
  fitCanvasToStage();
}
function schedulePreview(){
  updateLabels();
  if(!baseImage||renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{drawLivePreview();renderQueued=false;});
}
function setActiveFilter(name){
  currentFilter=name;
  document.querySelectorAll(".filter-button").forEach(button=>button.classList.toggle("active",button.dataset.filter===name));
}
function resetAdjustments(){
  brightness.value=100;contrast.value=100;
  adjustmentIds.forEach(id=>{
    $(id).value=id==="saturation"?"100":"0";
  });
  updateLabels();updateAdjustmentLabels();drawLivePreview();
}
function loadSelectedFile(file){
  if(!file)return;
  const allowed=["image/jpeg","image/png","image/webp","image/bmp"];
  if(!allowed.includes(file.type)){setStatus("Choose a PNG, JPG, WEBP or BMP image.");return;}
  if(file.size>10*1024*1024){setStatus("Maximum image size is 10 MB.");return;}
  sourceFile=file;originalSourceFile=file;
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    if(img.naturalWidth>4000||img.naturalHeight>4000){URL.revokeObjectURL(url);setStatus("Image dimensions must not exceed 4000 × 4000 pixels.");return;}
    sourceImage=img;baseImage=img;currentFilter="original";setActiveFilter("original");
    canvas.hidden=false;$("emptyState").hidden=true;
    $("fileInfo").textContent=`${file.name} · ${(file.size/1024).toFixed(1)} KB`;
    $("resetAll").disabled=false;$("resetAdjustments").disabled=false;$("downloadButton").disabled=false;
    $("resizeWidth").value=img.naturalWidth;$("resizeHeight").value=img.naturalHeight;
    $("cropX").value=0;$("cropY").value=0;
    $("cropWidth").value=img.naturalWidth;$("cropHeight").value=img.naturalHeight;
    ["applyResize","rotateLeft","rotateRight","applyCrop","enableCropSelection","comparisonRange"].forEach(id=>$(id).disabled=false);
    $("deleteImage").disabled=false;
    if($("comparisonView"))$("comparisonView").hidden=true;
    resetAdjustments();setStatus("Image loaded. Adjustments are live.");
    historyStates.length=0;redoStates.length=0;
    requestAnimationFrame(()=>{commitHistory();updateHistoryButtons();});
    URL.revokeObjectURL(url);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);setStatus("Could not read this image.");};
  img.src=url;
}
$("uploadButton").addEventListener("click",()=>imageInput.click());
$("browseButton").addEventListener("click",()=>imageInput.click());
imageInput.addEventListener("change",e=>loadSelectedFile(e.target.files[0]));
window.addEventListener("resize",()=>{
  if(baseImage)fitCanvasToStage();
});
const dropzone=$("dropzone");
["dragenter","dragover"].forEach(eventName=>dropzone.addEventListener(eventName,e=>{e.preventDefault();dropzone.style.borderColor="#5268e8";}));
["dragleave","drop"].forEach(eventName=>dropzone.addEventListener(eventName,e=>{e.preventDefault();dropzone.style.borderColor="";}));
dropzone.addEventListener("drop",e=>loadSelectedFile(e.dataTransfer.files[0]));
brightness.addEventListener("input",schedulePreview);
contrast.addEventListener("input",schedulePreview);
adjustmentIds.forEach(id=>{
  $(id).addEventListener("input",()=>{
    updateAdjustmentLabels();
    schedulePreview();
  });
  $(id).addEventListener("change",()=>requestAnimationFrame(commitHistory));
});
brightness.addEventListener("change",()=>requestAnimationFrame(commitHistory));
contrast.addEventListener("change",()=>requestAnimationFrame(commitHistory));
$("resetAdjustments").addEventListener("click",()=>{resetAdjustments();requestAnimationFrame(commitHistory);});

document.querySelectorAll(".side-tab[data-tab]").forEach(tab=>{
  tab.addEventListener("click",()=>{
    document.querySelectorAll(".side-tab[data-tab]").forEach(item=>item.classList.toggle("active",item===tab));
    const tabIds={adjust:"adjustPanel",filters:"filtersPanel",resize:"resizePanel",rotate:"rotatePanel",compare:"comparePanel",color:"colorPanel",video:"videoPanel",webcam:"webcamPanel",batch:"batchPanel"};
    Object.entries(tabIds).forEach(([name,id])=>$(id).classList.toggle("hidden",tab.dataset.tab!==name));
    if(tab.dataset.tab!=="webcam")stopWebcam();
  });
});

async function applyFilter(filter){
  if(!sourceFile){setStatus("Upload an image before applying a filter.");return;}
  if(filter==="original"){baseImage=sourceImage;sourceFile=originalSourceFile||sourceFile;setActiveFilter(filter);drawLivePreview();requestAnimationFrame(commitHistory);setStatus("Original image restored. Adjustments remain available.");return;}
  setStatus("Applying filter...");
  document.querySelectorAll(".filter-button").forEach(b=>b.disabled=true);
  const data=new FormData();data.append("image",sourceFile);data.append("operation",filter);
  try{
    let response=null;
    let lastError=null;
    for(const endpoint of ["/api/process","http://127.0.0.1:5000/api/process"]){
      try{
        response=await fetch(endpoint,{method:"POST",body:data});
        break;
      }catch(error){lastError=error;}
    }
    if(!response){
      throw new Error(lastError?.message==="Failed to fetch"
        ? "Filter server unavailable. Start the Flask app and open http://127.0.0.1:5000."
        : (lastError?.message||"Could not contact the filter server."));
    }
    if(!response.ok){
      const contentType=response.headers.get("content-type")||"";
      let message="Filter failed.";
      if(contentType.includes("application/json")){
        const error=await response.json();
        message=error.error||message;
      }else{
        const text=(await response.text()).trim();
        if(text)message=text;
      }
      throw new Error(message);
    }
    const blob=await response.blob(), url=URL.createObjectURL(blob), img=new Image();
    img.onload=()=>{baseImage=img;setActiveFilter(filter);drawLivePreview();requestAnimationFrame(commitHistory);URL.revokeObjectURL(url);setStatus("Filter applied. Brightness and contrast remain live.");};
    img.onerror=()=>{URL.revokeObjectURL(url);setStatus("Could not display filtered image.");};
    img.src=url;
  }catch(error){setStatus(error.message);}
  finally{document.querySelectorAll(".filter-button").forEach(b=>b.disabled=false);}
}
document.querySelectorAll(".filter-button").forEach(button=>button.addEventListener("click",()=>applyFilter(button.dataset.filter)));

function replaceBaseWithCanvas(tempCanvas){
  tempCanvas.toBlob(blob=>{
    if(!blob){setStatus("Could not update the image.");return;}
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      baseImage=img;
      sourceFile=new File([blob],"edited-image.png",{type:"image/png"});
      drawLivePreview();
      requestAnimationFrame(commitHistory);
      URL.revokeObjectURL(url);
      setStatus("Image updated.");
    };
    img.onerror=()=>{URL.revokeObjectURL(url);setStatus("Could not update the image.");};
    img.src=url;
  },"image/png");
}

$("resizeWidth").addEventListener("input",()=>{
  if(!$("keepAspect").checked||!baseImage)return;
  const width=Number($("resizeWidth").value);
  const imageWidth=baseImage.naturalWidth||baseImage.width;
  const imageHeight=baseImage.naturalHeight||baseImage.height;
  if(width>0)$("resizeHeight").value=Math.round(imageHeight*(width/imageWidth));
});
$("resizeHeight").addEventListener("input",()=>{
  if(!$("keepAspect").checked||!baseImage)return;
  const height=Number($("resizeHeight").value);
  const imageWidth=baseImage.naturalWidth||baseImage.width;
  const imageHeight=baseImage.naturalHeight||baseImage.height;
  if(height>0)$("resizeWidth").value=Math.round(imageWidth*(height/imageHeight));
});
$("applyResize").addEventListener("click",()=>{
  if(!baseImage)return;
  const width=Number($("resizeWidth").value),height=Number($("resizeHeight").value);
  if(width<1||height<1||width>4000||height>4000){setStatus("Resize dimensions must be between 1 and 4000 pixels.");return;}
  const temp=document.createElement("canvas");temp.width=width;temp.height=height;
  temp.getContext("2d").drawImage(baseImage,0,0,width,height);
  replaceBaseWithCanvas(temp);
});

function rotateImage(degrees){
  if(!baseImage)return;
  const width=baseImage.naturalWidth||baseImage.width,height=baseImage.naturalHeight||baseImage.height;
  const temp=document.createElement("canvas");
  if(degrees===90||degrees===-90){temp.width=height;temp.height=width;}else{temp.width=width;temp.height=height;}
  const context=temp.getContext("2d");
  context.translate(temp.width/2,temp.height/2);context.rotate(degrees*Math.PI/180);
  context.drawImage(baseImage,-width/2,-height/2);
  replaceBaseWithCanvas(temp);
  $("resizeWidth").value=temp.width;$("resizeHeight").value=temp.height;
  $("cropWidth").value=temp.width;$("cropHeight").value=temp.height;
}
$("rotateLeft").addEventListener("click",()=>rotateImage(-90));
$("rotateRight").addEventListener("click",()=>rotateImage(90));
let cropMode=false,cropDrag=null,cropSelectionSource=null;

function currentCropRatio(){
  const value=$("cropRatio").value;
  if(value==="free")return null;
  const [width,height]=value.split(":").map(Number);
  return width/height;
}
function updateCropSelectionRect(startX,startY,endX,endY){
  const rect=canvas.getBoundingClientRect();
  let left=Math.max(0,Math.min(startX,endX)-rect.left);
  let top=Math.max(0,Math.min(startY,endY)-rect.top);
  let width=Math.abs(endX-startX);
  let height=Math.abs(endY-startY);
  width=Math.min(width,rect.width-left);
  height=Math.min(height,rect.height-top);
  const ratio=currentCropRatio();
  if(ratio){
    if(width/height>ratio)width=height*ratio;
    else height=width/ratio;
  }
  const selection=$("cropSelection");
  selection.hidden=false;
  selection.style.left=`${rect.left-$("canvasStage").getBoundingClientRect().left+left}px`;
  selection.style.top=`${rect.top-$("canvasStage").getBoundingClientRect().top+top}px`;
  selection.style.width=`${width}px`;
  selection.style.height=`${height}px`;
  selection.style.setProperty("--crop-width",`${width}px`);
  selection.style.setProperty("--crop-height",`${height}px`);

  const sourceWidth=baseImage.naturalWidth||baseImage.width;
  const sourceHeight=baseImage.naturalHeight||baseImage.height;
  const scaleX=sourceWidth/rect.width,scaleY=sourceHeight/rect.height;
  cropSelectionSource={
    x:Math.round(left*scaleX),
    y:Math.round(top*scaleY),
    width:Math.round(width*scaleX),
    height:Math.round(height*scaleY)
  };
  $("cropX").value=cropSelectionSource.x;$("cropY").value=cropSelectionSource.y;
  $("cropWidth").value=cropSelectionSource.width;$("cropHeight").value=cropSelectionSource.height;
}
$("enableCropSelection").addEventListener("click",()=>{
  if(!baseImage)return;
  cropMode=!cropMode;
  $("enableCropSelection").textContent=cropMode?"Cancel crop selection":"Drag to select crop";
  canvas.style.cursor=cropMode?"crosshair":"";
  if(!cropMode){cropDrag=null;$("cropSelection").hidden=true;}
  setStatus(cropMode?"Drag across the preview to select a crop area.":"Crop selection canceled.");
});
canvas.addEventListener("pointerdown",event=>{
  if(!cropMode||canvas.hidden)return;
  event.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const x=Math.max(rect.left,Math.min(event.clientX,rect.right));
  const y=Math.max(rect.top,Math.min(event.clientY,rect.bottom));
  cropDrag={startX:x,startY:y};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove",event=>{
  if(!cropMode||!cropDrag)return;
  updateCropSelectionRect(cropDrag.startX,cropDrag.startY,event.clientX,event.clientY);
});
canvas.addEventListener("pointerup",event=>{
  if(!cropMode||!cropDrag)return;
  updateCropSelectionRect(cropDrag.startX,cropDrag.startY,event.clientX,event.clientY);
  cropDrag=null;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
});
$("cropRatio").addEventListener("change",()=>{
  cropSelectionSource=null;$("cropSelection").hidden=true;
});
$("applyCrop").addEventListener("click",()=>{
  if(!baseImage)return;
  let x=Number($("cropX").value),y=Number($("cropY").value),width=Number($("cropWidth").value),height=Number($("cropHeight").value);
  if(cropSelectionSource){({x,y,width,height}=cropSelectionSource);}
  const sourceWidth=baseImage.naturalWidth||baseImage.width,sourceHeight=baseImage.naturalHeight||baseImage.height;
  if(x<0||y<0||width<1||height<1||x+width>sourceWidth||y+height>sourceHeight){setStatus("Crop area must stay inside the image.");return;}
  const temp=document.createElement("canvas");temp.width=width;temp.height=height;
  temp.getContext("2d").drawImage(baseImage,x,y,width,height,0,0,width,height);
  replaceBaseWithCanvas(temp);
  $("resizeWidth").value=width;$("resizeHeight").value=height;
  cropSelectionSource=null;$("cropSelection").hidden=true;cropMode=false;canvas.style.cursor="";
  $("enableCropSelection").textContent="Drag to select crop";
});

function updateComparison(){
  if(!sourceImage||!baseImage)return;
  const original=$("comparisonOriginal"),edited=$("comparisonEdited");
  const width=sourceImage.naturalWidth,height=sourceImage.naturalHeight;
  original.width=width;original.height=height;
  edited.width=canvas.width;edited.height=canvas.height;
  original.getContext("2d").drawImage(sourceImage,0,0,width,height);
  edited.getContext("2d").drawImage(canvas,0,0,edited.width,edited.height);
  const stage=$("canvasStage"),availableWidth=Math.max(160,stage.clientWidth-24),availableHeight=Math.min(window.innerHeight*.65,720);
  const scale=Math.min(availableWidth/width,availableHeight/height);
  const displayWidth=Math.round(width*scale),displayHeight=Math.round(height*scale);
  const view=$("comparisonView");view.style.width=`${displayWidth}px`;view.style.height=`${displayHeight}px`;
  [original,edited].forEach(item=>{item.style.width=`${displayWidth}px`;item.style.height=`${displayHeight}px`;});
  const position=$("comparisonRange").value;
  edited.style.clipPath=`inset(0 ${100-position}% 0 0)`;
  $("comparisonDivider").style.left=`${position}%`;
}
$("comparisonRange").addEventListener("input",updateComparison);
document.querySelector(".side-tab[data-tab='compare']").addEventListener("click",()=>{
  if(!sourceImage)return;
  canvas.hidden=true;$("comparisonView").hidden=false;
  updateComparison();
});
document.querySelectorAll(".side-tab[data-tab]:not([data-tab='compare'])").forEach(tab=>tab.addEventListener("click",()=>{
  $("comparisonView").hidden=true;if(sourceImage)canvas.hidden=false;
}));

$("chooseVideo").addEventListener("click",$("videoInput").click.bind($("videoInput")));
$("videoInput").addEventListener("change",()=>{
  selectedVideo=$("videoInput").files[0]||null;
  $("extractFrame").disabled=!selectedVideo;
  $("videoFileInfo").classList.toggle("hidden",!selectedVideo);
  $("deleteVideo").classList.toggle("hidden",!selectedVideo);
  if(selectedVideo){
    $("videoFileInfo").textContent=`${selectedVideo.name} · ${(selectedVideo.size/1024/1024).toFixed(1)} MB`;
  }
});
$("deleteVideo").addEventListener("click",()=>{
  selectedVideo=null;$("videoInput").value="";
  $("extractFrame").disabled=true;$("videoFileInfo").classList.add("hidden");$("deleteVideo").classList.add("hidden");
  setStatus("Video deleted.");
});
$("extractFrame").addEventListener("click",async()=>{
  const file=selectedVideo;if(!file)return;
  setStatus("Extracting frame...");
  const data=new FormData();data.append("video",file);data.append("timestamp",$("frameTimestamp").value);
  try{
    const response=await fetch("/api/extract-frame",{method:"POST",body:data});
    if(!response.ok){
      let message="Frame extraction failed.";
      try{message=(await response.json()).error||message;}catch(_error){}
      throw new Error(message);
    }
    const blob=await response.blob();
    const frameFile=new File([blob],"extracted-frame.png",{type:"image/png"});
    loadSelectedFile(frameFile);
  }catch(error){setStatus(error.message);}
});

let webcamStream=null;
function stopWebcam(){
  if(webcamStream){
    webcamStream.getTracks().forEach(track=>track.stop());
    webcamStream=null;
  }
  $("webcamVideo").srcObject=null;
  $("captureWebcam").disabled=true;
  $("startWebcam").textContent="Start webcam";
}
$("startWebcam").addEventListener("click",async()=>{
  if(webcamStream){stopWebcam();return;}
  if(!navigator.mediaDevices?.getUserMedia){setStatus("Webcam capture is not supported in this browser.");return;}
  try{
    webcamStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    $("webcamVideo").srcObject=webcamStream;$("captureWebcam").disabled=false;$("startWebcam").textContent="Stop webcam";setStatus("Webcam ready.");
  }catch(error){setStatus("Could not access the webcam: "+error.message);}
});
$("captureWebcam").addEventListener("click",()=>{
  if(!webcamStream)return;
  const video=$("webcamVideo"),temp=document.createElement("canvas");
  temp.width=video.videoWidth;temp.height=video.videoHeight;
  temp.getContext("2d").drawImage(video,0,0);
  temp.toBlob(blob=>{
    if(!blob)return;
    loadSelectedFile(new File([blob],"webcam-capture.png",{type:"image/png"}));
    stopWebcam();
    setStatus("Webcam photo captured.");
  },"image/png");
});

$("chooseBatch").addEventListener("click",$("batchInput").click.bind($("batchInput")));
$("batchInput").addEventListener("change",()=>{
  batchFiles=Array.from($("batchInput").files);
  $("processBatch").disabled=batchFiles.length===0;
  $("batchFileInfo").classList.toggle("hidden",batchFiles.length===0);
  $("deleteBatch").classList.toggle("hidden",batchFiles.length===0);
  $("batchFileInfo").textContent=`${batchFiles.length} image${batchFiles.length===1?"":"s"} selected`;
  renderBatchPreview();
});
function clearBatchUrls(){
  batchObjectUrls.forEach(url=>URL.revokeObjectURL(url));
  batchObjectUrls=[];
}
function renderBatchPreview(){
  clearBatchUrls();
  $("batchPreview").replaceChildren();
  batchFiles.forEach(file=>{
    const url=URL.createObjectURL(file);batchObjectUrls.push(url);
    const card=document.createElement("div");card.className="batch-preview-item";
    const image=document.createElement("img");image.src=url;image.alt=file.name;
    const name=document.createElement("span");name.textContent=file.name;
    card.append(image,name);$("batchPreview").appendChild(card);
  });
}
$("deleteBatch").addEventListener("click",()=>{
  batchFiles=[];$("batchInput").value="";clearBatchUrls();$("batchPreview").replaceChildren();
  $("processBatch").disabled=true;$("batchFileInfo").classList.add("hidden");$("deleteBatch").classList.add("hidden");
  setStatus("Batch selection deleted.");
});
async function renderProcessedBatchPreview(files,operation){
  clearBatchUrls();
  $("batchPreview").replaceChildren();
  for(const file of files){
    const data=new FormData();data.append("image",file);data.append("operation",operation);
    try{
      const response=await fetch("/api/process",{method:"POST",body:data});
      if(!response.ok)throw new Error();
      const url=URL.createObjectURL(await response.blob());batchObjectUrls.push(url);
      const card=document.createElement("div");card.className="batch-preview-item";
      const image=document.createElement("img");image.src=url;image.alt=file.name;
      const name=document.createElement("span");name.textContent=file.name+" · processed";
      card.append(image,name);$("batchPreview").appendChild(card);
    }catch(_error){
      const url=URL.createObjectURL(file);batchObjectUrls.push(url);
      const card=document.createElement("div");card.className="batch-preview-item";
      const image=document.createElement("img");image.src=url;image.alt=file.name;
      const name=document.createElement("span");name.textContent=file.name+" · preview unavailable";
      card.append(image,name);$("batchPreview").appendChild(card);
    }
  }
}
$("processBatch").addEventListener("click",async()=>{
  const files=$("batchInput").files;if(!files.length)return;
  setStatus("Processing batch...");
  const data=new FormData();for(const file of files)data.append("images",file);
  data.append("operation",$("batchOperation").value);
  try{
    const response=await fetch("/api/batch-process",{method:"POST",body:data});
    if(!response.ok)throw new Error((await response.json()).error||"Batch processing failed.");
    const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`${$("batchOperation").value}-batch.zip`;document.body.appendChild(link);link.click();link.remove();
    URL.revokeObjectURL(url);
    await renderProcessedBatchPreview(files,$("batchOperation").value);
    setStatus(`Batch complete. ${files.length} images downloaded in a ZIP.`);
  }catch(error){setStatus(error.message);}
});

$("deleteImage").addEventListener("click",()=>{
  stopWebcam();
  sourceImage=null;baseImage=null;sourceFile=null;originalSourceFile=null;
  historyStates.length=0;redoStates.length=0;updateHistoryButtons();
  canvas.hidden=true;$("emptyState").hidden=false;$("comparisonView").hidden=true;
  $("fileInfo").textContent="No image selected";$("dimensions").textContent="";
  $("resetAll").disabled=true;$("resetAdjustments").disabled=true;$("downloadButton").disabled=true;$("deleteImage").disabled=true;
  ["applyResize","rotateLeft","rotateRight","applyCrop","enableCropSelection","comparisonRange"].forEach(id=>$(id).disabled=true);
  $("resizeWidth").value="";$("resizeHeight").value="";$("cropWidth").value="";$("cropHeight").value="";
  $("canvasStage").style.height="470px";$("canvasStage").style.minHeight="470px";
  imageInput.value="";
  setStatus("Upload an image to begin");
});
$("resetAll").addEventListener("click",()=>{
  if(!sourceImage)return;
  baseImage=sourceImage;sourceFile=originalSourceFile||sourceFile;setActiveFilter("original");resetAdjustments();requestAnimationFrame(commitHistory);setStatus("All edits reset.");
});
$("downloadButton").addEventListener("click",()=>{
  if(!baseImage)return;
  canvas.toBlob(blob=>{
    if(!blob){setStatus("Could not create download.");return;}
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="pixellab-edited-image.png";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  },"image/png");
});
