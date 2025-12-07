// index.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route API pour le formulaire de contact (simulation)
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  
  // Ici, vous pourriez ajouter du code pour envoyer un email ou sauvegarder dans une base de données
  console.log('Message reçu:', { name, email, message });
  
  // Simuler un délai de traitement
  setTimeout(() => {
    res.status(200).json({ 
      success: true, 
      message: 'Message reçu avec succès!' 
    });
  }, 1000);
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});