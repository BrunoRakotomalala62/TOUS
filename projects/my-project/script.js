// public/script.js
document.addEventListener('DOMContentLoaded', () => {
  // Navigation mobile
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.nav-links');
  const navLinks = document.querySelectorAll('.nav-links li');

  burger.addEventListener('click', () => {
    // Toggle Nav
    nav.classList.toggle('nav-active');
    
    // Animate Links
    navLinks.forEach((link, index) => {
      if (link.style.animation) {
        link.style.animation = '';
      } else {
        link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
      }
    });
    
    // Burger Animation
    burger.classList.toggle('toggle');
  });

  // Smooth scrolling pour les liens d'ancrage
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Fermer le menu mobile si ouvert
      if (nav.classList.contains('nav-active')) {
        nav.classList.remove('nav-active');
        burger.classList.remove('toggle');
        navLinks.forEach(link => {
          link.style.animation = '';
        });
      }
      
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      window.scrollTo({
        top: targetElement.offsetTop - 80,
        behavior: 'smooth'
      });
    });
  });

  // Animation au défilement
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
      }
    });
  }, { threshold: 0.1 });

  // Observer les sections
  document.querySelectorAll('section').forEach(section => {
    section.classList.add('hidden');
    observer.observe(section);
  });

  // Gestion du formulaire de contact
  const contactForm = document.getElementById('contact-form');
  
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const message = document.getElementById('message').value;
      
      // Simuler l'envoi du formulaire
      console.log('Formulaire soumis:', { name, email, message });
      
      // Afficher un message de confirmation
      const formContainer = contactForm.parentElement;
      contactForm.style.display = 'none';
      
      const confirmationMessage = document.createElement('div');
      confirmationMessage.className = 'confirmation-message';
      confirmationMessage.innerHTML = `
        <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success-color); margin-bottom: 1rem;"></i>
        <h3>Merci ${name} !</h3>
        <p>Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.</p>
      `;
      
      formContainer.appendChild(confirmationMessage);
      
      // Réinitialiser le formulaire après 5 secondes
      setTimeout(() => {
        contactForm.reset();
        confirmationMessage.remove();
        contactForm.style.display = 'flex';
      }, 5000);
    });
  }

  // Ajouter des styles pour l'animation au défilement
  const style = document.createElement('style');
  style.textContent = `
    .hidden {
      opacity: 0;
      transform: translateY(20px);
      transition: all 1s ease;
    }
    
    .show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .confirmation-message {
      text-align: center;
      padding: 2rem;
      animation: fadeIn 0.5s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
});