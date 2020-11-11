var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

// MongoDB Connection ===================================
var mongoose = require('mongoose'); // import de mongoose

/* Connection à MongoDB via Mongoose*/
mongoose.connect('mongodb://localhost/dataTourismDA3T', { useNewUrlParser: true }, function(error) {
    if (error)
        console.log(error);
});

/* Définition du schémas Mongoose 
    un schéma permet de définir la disposition des documents retournés
*/
var Schema = mongoose.Schema;
var JsonSchema = new Schema({
    type: Schema.Types.Mixed,
    geometry: Schema.Types.Mixed,
    properties: Schema.Types.Mixed
});

/* Définition du modèle Mongoose
    permet de mapper une collection
    mongoose.model(<nom_du_modele>, <schema>, <collection_utilisée>)
*/
var Json = mongoose.model('JString', JsonSchema, 'enriched_traces');

// MongoDB Connection - END ============================

// Gestion des requêtes ================================

/* GET json data. 
    retourne tout les docuements stockés dans la collection définie dans le modèle Mongoose dans l'ordre ascendent
*/
router.get('/jsonData', function(req, res) {
    // on définit les informations que l'on veut extraire
    Json.find({}, {
        'geometry.coordinates': 1, // les coordonnées GPS (INFO: il faudrat inverser les valeurs lors de leur utilisation)
        'properties': {
            'timestamp': 1, // le timestamp de l'enregistrement de la donnée (sert pour le tri de ces dernières)
            'id': 1, // l'identifiant de la trace
            'lvl1_attribute': 1, // un des attributs du point
            'lvl2_attribute': 1, // un des attributs du point
            'lvl3_attribute': 1, // un des attributs du point
            'lvl4_attribute': 1 // un des attributs du point
        }
    }).sort(
        // on trie les données par le timestamp afin de les avoir dans l'ordre ascedent
        { 'properties.timestamp': 'asc' }
    ).exec((err, docs) => {
        // si il y a une erreur on l'affiche
        if (err)
            console.log(err);
        // on retourne les documents qui ont été fourni par mongoDB (ici tous)
        res.json(docs);
    });
});

/* GET specific trace data. 
    retourne tout les documents correcpondant à une trace spécifiée
*/
router.get('/trace/:id', function(req, res) {
    if (req.params.id) {
        // on définit les informations que l'on veut extraire
        Json.find({}, {
            'geometry.coordinates': 1, // les coordonnées GPS (INFO: il faudrat inverser les valeurs lors de leur utilisation)
            'properties': {
                'timestamp': 1, // le timestamp de l'enregistrement de la donnée (sert pour le tri de ces dernières)
                'id': req.params.id, // l'identifiant de la trace
                'lvl1_attribute': 1, // un des attributs du point
                'lvl2_attribute': 1, // un des attributs du point
                'lvl3_attribute': 1, // un des attributs du point
                'lvl4_attribute': 1 // un des attributs du point
            }
        }).sort(
            // on trie les données par le timestamp afin de les avoir dans l'ordre ascedent
            { 'properties.timestamp': 'asc' }
        ).exec((err, docs) => {
            // si il y a une erreur on l'affiche
            if (err)
                console.log(err);
            // on retourne les documents qui ont été fourni par mongoDB (ici tous)
            res.json(docs);
        });
    }
});

/* GET attribute level distinct values 
    retourne les valeurs distinctes de chaque attribut de détail en fonction du niveau de  détail spécifié (ici 4 niveaux possible, on utilise 5) pour une trace spécifiée
*/
router.get('/trace_detailLevel/:id/:level', function(req, res) {
    // si le niveau de détail fournit est compris dans un tableau allant de 1 à 4, alors créé le nom de la propriété
    if (req.params.id && [...Array(5).keys()].slice(1).includes(parseInt(req.params.level))) {
        // on cherche les valeurs distinctes de la propriété créée puis les retourne au format json
        Json.find({}, { 'properties.id': req.params.id }).distinct('properties.lvl' + req.params.level + '_attribute', function(error, docs) {
            if (error)
                console.log(error);
            res.json(docs);
        });
    }
});

/* GET Map page 
    permet de passer des données utiles pour notre map
*/
router.get('/map', function(req, res) {
    Json.find({}, {}, function(error, docs) {
        res.render('map', {
            "jmap": docs,
            lat: 46.160329, // les coordonnées du centre de la Rochelle
            lng: -1.151139
        });
    });
});

// Gestion des requêtes - END ==========================

module.exports = router;