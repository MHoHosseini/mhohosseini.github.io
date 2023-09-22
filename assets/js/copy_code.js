<<<<<<< HEAD
// create element for copy button in code blocks
var codeBlocks = document.querySelectorAll('pre');
codeBlocks.forEach(function (codeBlock) {
  if (codeBlock.querySelector('pre:not(.lineno)') || codeBlock.querySelector('code')) {
    // create copy button
    var copyButton = document.createElement('button');
    copyButton.className = 'copy';
    copyButton.type = 'button';
    copyButton.ariaLabel = 'Copy code to clipboard';
    copyButton.innerText = 'Copy';
    copyButton.innerHTML = '<i class="fas fa-clipboard"></i>';

    // get code from code block and copy to clipboard
    copyButton.addEventListener('click', function () {
      // check if code block has line numbers
      // i.e. `kramdown.syntax_highlighter_opts.block.line_numbers` set to true in _config.yml
      // or using `jekyll highlight` liquid tag with `linenos` option
      if (codeBlock.querySelector('pre:not(.lineno)')) {
        // get code from code block ignoring line numbers
        var code = codeBlock.querySelector('pre:not(.lineno)').innerText.trim();
      } else { // if (codeBlock.querySelector('code')) {
        // get code from code block when line numbers are not displayed
        var code = codeBlock.querySelector('code').innerText.trim();
      }
      window.navigator.clipboard.writeText(code);
      copyButton.innerText = 'Copied';
      copyButton.innerHTML = '<i class="fas fa-clipboard-check"></i>';
      var waitFor = 3000;

      setTimeout(function () {
        copyButton.innerText = 'Copy';
        copyButton.innerHTML = '<i class="fas fa-clipboard"></i>';
      }, waitFor);
    });
    
    // create wrapper div
    var wrapper = document.createElement('div');
    wrapper.className = 'code-display-wrapper';

    // add copy button and code block to wrapper div
    const parent = codeBlock.parentElement;
    parent.insertBefore(wrapper, codeBlock);
    wrapper.append(codeBlock);
    wrapper.append(copyButton);
  }
});
=======
var codeBlocks=document.querySelectorAll("pre");codeBlocks.forEach(function(e){if(e.querySelector("pre:not(.lineno)")||e.querySelector("code")){var n=document.createElement("button");n.className="copy",n.type="button",n.ariaLabel="Copy code to clipboard",n.innerText="Copy",n.innerHTML='<i class="fas fa-clipboard"></i>',n.addEventListener("click",function(){if(e.querySelector("pre:not(.lineno)"))var r=e.querySelector("pre:not(.lineno)").innerText.trim();else r=e.querySelector("code").innerText.trim();window.navigator.clipboard.writeText(r),n.innerText="Copied",n.innerHTML='<i class="fas fa-clipboard-check"></i>',setTimeout(function(){n.innerText="Copy",n.innerHTML='<i class="fas fa-clipboard"></i>'},3e3)});var r=document.createElement("div");r.className="code-display-wrapper",e.parentElement.insertBefore(r,e),r.append(e),r.append(n)}});
>>>>>>> ed4db9736df784e71a6530773c6ee409fb0006e5
