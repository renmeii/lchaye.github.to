// Glitch effect for text
function applyGlitchEffect(element) {
  let originalText = element.textContent;
  let glitchInterval;

  element.addEventListener('mouseover', () => {
    glitchInterval = setInterval(() => {
      element.textContent = originalText
        .split('')
        .map(char => Math.random() > 0.8 ? String.fromCharCode(Math.floor(Math.random() * 26) + 65) : char)
        .join('');
    }, 100);
  });

  element.addEventListener('mouseout', () => {
    clearInterval(glitchInterval);
    element.textContent = originalText;
  });
}

// Floating particles effect
function createParticles() {
  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'particles-container';
  document.body.appendChild(particlesContainer);

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = `${Math.random() * 100}vh`;
    particle.style.animationDuration = `${Math.random() * 10 + 5}s`;
    particlesContainer.appendChild(particle);
  }
}

// Cursor trail effect
function createCursorTrail() {
  const trailContainer = document.createElement('div');
  trailContainer.className = 'cursor-trail';
  document.body.appendChild(trailContainer);

  document.addEventListener('mousemove', (e) => {
    const trail = document.createElement('div');
    trail.className = 'trail';
    trail.style.left = e.pageX + 'px';
    trail.style.top = e.pageY + 'px';
    trailContainer.appendChild(trail);

    setTimeout(() => {
      trail.remove();
    }, 500);
  });
}

// Initialize effects when the document is ready
document.addEventListener('DOMContentLoaded', () => {
  const glitchElements = document.querySelectorAll('.glitch');
  glitchElements.forEach(applyGlitchEffect);

  createParticles();
  createCursorTrail();

  // Typewriter effect for the main title
  const title = document.querySelector('h1');
  const titleText = title.textContent;
  title.textContent = '';
  let i = 0;

  function typeWriter() {
    if (i < titleText.length) {
      title.textContent += titleText.charAt(i);
      i++;
      setTimeout(typeWriter, 100);
    } else {
      setTimeout(eraseText, 2000);
    }
  }

  function eraseText() {
    if (i > 0) {
      title.textContent = titleText.substring(0, i-1);
      i--;
      setTimeout(eraseText, 50);
    } else {
      setTimeout(typeWriter, 1000);
    }
  }

  typeWriter();

  // Glitch effect on hover for navigation items
  const navItems = document.querySelectorAll('nav a');
  navItems.forEach(item => {
    item.addEventListener('mouseover', () => {
      item.style.animation = 'glitch 0.3s infinite';
    });
    item.addEventListener('mouseout', () => {
      item.style.animation = 'none';
    });
  });

  // Random text glitch effect
  const glitchTexts = document.querySelectorAll('.space-y-4 p');
  setInterval(() => {
    const randomText = glitchTexts[Math.floor(Math.random() * glitchTexts.length)];
    randomText.style.animation = 'textGlitch 0.2s';
    setTimeout(() => {
      randomText.style.animation = 'none';
    }, 200);
  }, 3000);

  // Cursor trail effect
  const cursor = document.createElement('div');
  cursor.classList.add('cursor-trail');
  document.body.appendChild(cursor);

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.pageX + 'px';
    cursor.style.top = e.pageY + 'px';
  });
});

// Add these styles to your HTML file or a separate CSS file
const styles = `
  .particles-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: -1;
  }

  .particle {
    position: absolute;
    width: 2px;
    height: 2px;
    background-color: rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    animation: float linear infinite;
  }

  @keyframes float {
    0% { transform: translateY(0); }
    100% { transform: translateY(-100vh); }
  }

  .cursor-trail {
    position: fixed;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.5);
    mix-blend-mode: difference;
    pointer-events: none;
    transition: width 0.2s, height 0.2s;
    z-index: 9999;
  }

  body:hover .cursor-trail {
    width: 50px;
    height: 50px;
  }

  @keyframes glitch {
    0% { transform: translate(2px, 2px); }
    25% { transform: translate(-2px, -2px); }
    50% { transform: translate(-2px, 2px); }
    75% { transform: translate(2px, -2px); }
    100% { transform: translate(2px, 2px); }
  }

  @keyframes textGlitch {
    0% { opacity: 1; transform: translate(0); }
    20% { opacity: 0.8; transform: translate(-2px, 2px); }
    40% { opacity: 0.6; transform: translate(2px, -2px); }
    60% { opacity: 0.8; transform: translate(-1px, 1px); }
    80% { opacity: 0.9; transform: translate(1px, -1px); }
    100% { opacity: 1; transform: translate(0); }
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

