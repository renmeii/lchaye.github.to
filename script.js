document.addEventListener('DOMContentLoaded', () => {
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
  const glitchTexts = document.querySelectorAll('.glitch-text');
  setInterval(() => {
    const randomText = glitchTexts[Math.floor(Math.random() * glitchTexts.length)];
    randomText.style.animation = 'textGlitch 0.2s';
    setTimeout(() => {
      randomText.style.animation = 'none';
    }, 200);
  }, 3000);

  // Create stars
  const starsContainer = document.createElement('div');
  starsContainer.className = 'stars-container';
  document.body.appendChild(starsContainer);

  for (let i = 0; i < 100; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = `${Math.random() * 100}vw`;
    star.style.top = `${Math.random() * 100}vh`;
    star.style.animationDuration = `${Math.random() * 3 + 2}s`;
    starsContainer.appendChild(star);
  }
});

// Add these styles to your HTML file or a separate CSS file
const styles = `
  .stars-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: -1;
  }

  .star {
    position: absolute;
    width: 2px;
    height: 2px;
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: twinkle linear infinite;
  }

  @keyframes twinkle {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
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

  body {
    cursor: none;
  }

  .custom-cursor {
    width: 20px;
    height: 20px;
    border: 2px solid white;
    border-radius: 50%;
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    transition: transform 0.1s ease;
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

// Custom cursor
const cursor = document.createElement('div');
cursor.classList.add('custom-cursor');
document.body.appendChild(cursor);

document.addEventListener('mousemove', (e) => {
  cursor.style.left = e.clientX + 'px';
  cursor.style.top = e.clientY + 'px';
});

document.addEventListener('mousedown', () => {
  cursor.style.transform = 'scale(0.8)';
});

document.addEventListener('mouseup', () => {
  cursor.style.transform = 'scale(1)';
});
