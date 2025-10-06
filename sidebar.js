


$(document).ready(function(){
  //Open side bar
    $('.menu-btn').click(function(){
    $('.side-bar').addClass('active');
    $('.menu-btn').css("visibility", "hidden")
  });
  //Close side bar
    $('.close-btn').click(function(){
    $('.side-bar').removeClass('active');
    $('.menu-btn').css("visibility", "visible");
  });
})