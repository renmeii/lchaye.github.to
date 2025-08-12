document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Toggle Background';
  toggleButton.className = 'fixed top-4 right-4 p-2 bg-white text-black rounded-lg shadow-lg';
  document.body.appendChild(toggleButton);

  let isGalaxy = true;

  toggleButton.addEventListener('click', () => {
    if (isGalaxy) {
      body.classList.remove('galaxy-background');
      body.classList.add('room-background');
    } else {
      body.classList.remove('room-background');
      body.classList.add('galaxy-background');
    }
    isGalaxy = !isGalaxy;
  });


  body.classList.add('galaxy-background');

 
  const title = document.querySelector('h1');
  const titleText = title.textContent;
  title.textContent = '';
  let i = 0;

  function typeWriter() {
    if (i < titleText.length) {
      title.textContent += titleText.charAt(i);
      i++;
      setTimeout(typeWriter, 100);
    }
  }

  typeWriter();

  
  const navItems = document.querySelectorAll('nav a');
  navItems.forEach(item => {
    item.addEventListener('mouseover', () => {
      item.style.animation = 'glitch 0.3s infinite';
    });
    item.addEventListener('mouseout', () => {
      item.style.animation = 'none';
    });
  });

  
  const glitchTexts = document.querySelectorAll('.glitch-text');
  setInterval(() => {
    const randomText = glitchTexts[Math.floor(Math.random() * glitchTexts.length)];
    randomText.style.animation = 'textGlitch 0.2s';
    setTimeout(() => {
      randomText.style.animation = 'none';
    }, 200);
  }, 3000);
  });

 
  const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate');
      }
    });

  elementsToAnimate.forEach(element => {
    observer.observe(element);
  });
});



