$(document).ready(function() {
  var input_counter = 2;
  $(".add-input").click(function() {
    input_counter += 1;
    $(".submit-btn").remove()
    $(".test-form").append("<label class=\"option" + input_counter +"\"> Option " + input_counter +"</label>" + "<input name=\"option" + input_counter + "\"" + "class=\"option" + input_counter + "\" />" )
    $(".test-form").append("<button type=\"submit\" class=\"submit-btn\">Submit</button>")
  })
  
  $(".remove-input").click(function() {
    if(input_counter > 2) {
      $(".option" + input_counter).remove()
      input_counter -= 1;
    }
  })
})
