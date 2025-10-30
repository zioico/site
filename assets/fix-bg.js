document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('[data-image]:not(img)').forEach(function(el){
    var u = el.getAttribute('data-image');
    if(!u) return;
    if(u.slice(0,2)==='//') u='https:'+u;
    if(u.slice(0,5)==='http:') u=u.replace(/^http:/,'https:');
    if(getComputedStyle(el).backgroundImage==='none' || !getComputedStyle(el).backgroundImage){
      el.style.backgroundImage='url("'+u+'")';
    }
  });
});