function loadPartial(name) {
    fetch(`partials/${name}`)
        .then(response => response.text())
        .then(html => {
            document.getElementById("partial-content").innerHTML = html;
        })
        .catch(err => {
            document.getElementById("partial-content").innerHTML = "<p>載入失敗</p>";
        });
}