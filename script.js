document.addEventListener('DOMContentLoaded', () => {
  const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate');
      }
    });
  }, {
    threshold: 0.1
  });

  elementsToAnimate.forEach(element => {
    observer.observe(element);
  });

  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();

      const webhookURL = 'https://discord.com/api/webhooks/1395181313798967368/HSwiokDDopSK6vteiEOq_c2SuCPTsln9UewDS9IYMXnK68pMNuEzXghcfg3VArDCT19L';
      const name = this.elements.name.value;
      const email = this.elements.email.value;
      const message = this.elements.message.value;

      const data = {
        content: `New message from WhiteSpace contact form:\nName: ${name}\nEmail: ${email}\nMessage: ${message}`
      };

      fetch(webhookURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      .then(response => {
        if (response.ok) {
          alert('Message sent successfully!');
          this.reset();
        } else {
          alert('There was an error sending your message. Please try again.');
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('There was an error sending your message. Please try again.');
      });
    });
  }

  // Smooth scrolling for navigation links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();

      document.querySelector(this.getAttribute('href')).scrollIntoView({
        behavior: 'smooth'
      });
    });
  });
});
