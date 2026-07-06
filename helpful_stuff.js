/* helpful_stuff.js — small UI helpers.
   Wires up collapsible sections: any element with class "collapsible" toggles
   the visibility of the element immediately after it (its .content sibling).
   Markup:
       <button class="collapsible">Show more</button>
       <div class="content"> ...hidden until clicked... </div>
*/

var coll = document.getElementsByClassName("collapsible");

for (var i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function () {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
        } else {
            content.style.maxHeight = content.scrollHeight + "px";
        }
    });
}
