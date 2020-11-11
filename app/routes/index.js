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
    name: String,
    type: Schema.Types.Mixed
});

/* Définition du modèle Mongoose
    permet de mapper une collection
    mongoose.model(<nom_du_modele>, <schema>, <collection_utilisée>)
*/
var Json = mongoose.model('JString', JsonSchema, 'enriched_traces');

// MongoDB Connection - END ============================

module.exports = router;