# WEB 3.0 - Données Touristique DA3T

### ANTELME Mathis

## Objectif du projet

> L'objectif de ce projet est de concevoir un outil de visualisation des traces enrichies sémantiquement dans le but de les éditer.

On attend les fonctionnalités suivantes:

1. **Chargement des traces** - Les traces sont disponibles au format *json*, cependant certaines traces ne sont pas valides (un `timestamp` négatif, les champs `id` et `id_user` sont équivalent, etc...);
2. **Sélection et affichage des traces** - L'outil devra permettre de sélectionner une ou plusieurs traces, puis de les afficher sur une carte de la ville de la Rochelle;
3. **Sélection et affichage de POI de la ville de la Rochelle** - Il s'agira de récupérer les **POI** (*Point of Interest*) de la Rochelle à partir d'une ontologie existante sur le web, puis, de les proposer à l'affichage;
4. **Sélection et affichage d'enrichissement sémantique des traces** - L'enrichissement sémantique s'organise en différents niveaux hiérachiques. L'outil devra permettre de sélectionner *un ou plusieurs* niveaux à afficher;
5. **Export PDF** - L'outil devra proposer un export au format **PDF**;

## Choix techniques

Pour la réalisation de ce projet j'ai décidé d'utiliser une application **Nodejs** qui utilisera les technologies suivantes:

- **[Leaflet](https://leafletjs.com/)** - Une bibliothèque légère et open-source qui permet de d'afficher des points, lignes, tracés et polygonnes sur une carte;
- **[MongoDB](https://www.mongodb.com/fr)** - Une base de donnée **NoSQL** rapide et facile à initialiser qui permettera de stocker les données des tracés au format **[GeoJSON](https://geojson.org/)**;
- **[Pug](https://pugjs.org/api/getting-started.html)** - Un système de patron qui permet de générer du **HTML** à la demande afin de gérer le front-end de l'application;

## Mise en place de MongoDB

Afin d'utiliser **MongoDB** pour stocker les données **GeoJSON**, nous devons tout d'abord l'installer comme [recommandé](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/). Une fois cela effectué, on l'activera comme n'importe quel service puis on s'y connectera avec les commandes suivantes: 

```bash
sudo systemctl start mongod.service # mise en route du service
mongo --host 127.0.0.1:27017 # connection a mongoDB
```

Une fois connecté à **MongoDB**, on initialisera une base de données nommée `dataTourismDA3T` avec la commande ci-dessous:

```nosql
use dataTourismDA3T;
```

## Nettoyage des traces

Les données fournies pour ce projet (ici présentes dans le répertoire `./data`), ne sont pas utilisable dans leur état actuel. En effet, les tracés non-enrichis ne sont pas au format **GeoJSON**, et certaines des entrées ne sont pas valides. 

Avant de pouvoir incorporer ces données dans **MongoDB**, il nous font donc les nettoyer, puis les convertir en un format exploitable.

### Tracés enrichis (`./data/enriched`)

Ces données sont celles qui nécessitent le moins de traitement. En effet, elles sont déjà au format **GeoJSON**, cependant **MongoDB** considère que le document n'est pas valide (cf: Figure 1). 

![l'erreur fournie par mongoDB lors de l'importation brute du fichier](./img/mongoDB_error.png)

Afin de corriger cela, nous allons utiliser l'utilitaire **[jq](https://stedolan.github.io/jq/)** qui permet, entre autres, de compacter le document et de le rendre compatible avec **MongoDB**. Pour cela on va utiliser la commande suivante:

```bash
jq --compact-output ".features" raw_dataset.json > ../cleaned/enriched_dataset.geojson
```

Suite à cela, l'importation des données dans **MongoDB** se fera sans soucis avec la commande suivante:

```bash
mongoimport --db dataTourismDA3T -c enriched_traces --file "../cleaned/enriched_dataset.geojson" --jsonArray
```

On pourra s'assurer de l'importation correcte des données en nous connectant à la base de données `mongo --host 127.0.0.1:27017` et en entrant les commandes suivantes qui vont permettre de nous connecter et d'afficher la première entrée dans la collection:

```nosql
use dataTourismDA3T;
db.enriched_traces.findOne();
```

![les traces enrichies dans la BDD](./img/enriched_traces_stored.png)

### Tracés non-enrichis (`./data/raw`)

Les données des tracés non-enrichis sont celles qui nécessite un nettoyage et une transformation au format **GeoJSON**. Heureusement pour nous, ce format n'est rien d'autre que du **JSON** avec certaines spécifications. Dans notre cas, les points enregistrés par l'application mobile doivent être stockés sous la forme suivante:

```json
{
    "type": "FeatureCollection",
    "name": "traces",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    50,
                    100
                ]
            },
            "properties": {
                "trace_id": 1,
                "timestamp": 100000
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    150,
                    20
                ]
            },
            "properties": {
                "trace_id": 2,
                "timestamp": 1000999
            }
        }
    ]
}
```

Cependant les données doivent être nettoyées avant d'être transformées. En effet certains des `timestamps` sont négatifs, donc invalides, et une trace peut être identifiée par la clé `id` ou `id_user`. Nous devons donc renommer les clefs identifiant les traces en `id` afin de faciliter le traitement, puis sélectionner les objets donc les `timestamps` sont positifs.

Pour cela on va de nouveau utiliser `jq`:

```bash
.[] | with_entries( if .key | contains("id_user") then .key |= sub("id_user";"id") else . end) # permet de renommer les clefs 'id_user' en 'id'
| select(.timestamp>=0) # sélectionne uniquement les objets JSON dont le timestamp n'est pas négatif
```

Une fois ces données nettoyées, on peut les transformer avec `jq` et la syntaxe suivante (en assumant que vos données soient stockées dans `./data/raw/raw_dataset.json`):

```bash
jq '
{
    type:"FeatureCollection", 
    name:"raw_traces", 
    features:[
        .[] | select(.timestamp>=0) | with_entries( if .key | contains("id_user") then .key |= sub("id_user";"id") else . end) | 
        {
            type:"Feature", 
            geometry:{
                type:"Point", 
                coordinates:[
                    .latitude, .longitude
                ]
            }, 
            properties: {
                timestamp:.timestamp, 
                trace_id:.id
            }
        }
    ]
}
' ./data/raw/raw_dataset.json > ./data/cleaned/dataset.geojson
```

> **Note:** je n'ai personellement pas réussi a utiliser cette commande sur le fichier fournit du fait de sa taille, le process s'arrête avant (malgré le fait que la commande fonctionne sur des fichiers de plus petite taille). Cependant l'affichage des tracés enrichis s'effectue de la même manière que ceux qui ne le sont pas, j'effectuerai donc la suite du projet en utilisant les tracés enrichis;

Une fois ces données nettoyées et transformées, on peut les compacter comme pour les premières puis les importer dans **MongDB** sous la collection `bare_traces`.

```bash
jq --compact-output ".features" ./data/cleaned/dataset.geojson > ./data/cleaned/compacted_dataset.geojson # on compacte les données
mongoimport --db dataTourismDA3T -c bare_traces --file "./data/cleaned/compacted_dataset.geojson" --jsonArray
```

On pourra s'assurer de l'importation correcte des données en nous connectant à la base de données `mongo --host 127.0.0.1:27017` et en entrant les commandes suivantes qui vont permettre de nous connecter et d'afficher la première entrée dans la collection:

```nosql
use dataTourismDA3T;
db.bare_traces.findOne();
```

> **Note:** Le fichier étant trop conséquent et la transformation des données impossible le compactage et l'import des données décrit ci-dessus est purement théorique;

## Mise en place de l'application Nodejs

Suite au nettoyage et l'importation des données dans la BDD, il est désormais temps de les utiliser dans notre application. Mais pour cela il nous faut créer notre application **Nodejs**. 

### Initialisation

Dans cette section, je vais décrire le processus de génération du squelette de l'application, la mise à jour des dépendances, le premier lancement de l'application ainsi que les explications du fonctionnement de cette dernière.

#### **Génération d'un squelette avec Express**

Dans un premier lieu nous allons utiliser le web framework **[express](https://expressjs.com/)**, qu'il faudrat installer grâce à **npm** (`sudo npm install express-generator -g`).

```bash
express --view=pug app
```

Cette commande permet de générer une application qui utilisera le moteur de template **pug** et qui sera sobrement nommée `app`. On obtient la hiérarchie de fichiers suivante:

![La hiérachie de l'application](./img/appFileTree.png)

Il s'organise de la façon suivante:

- **app.js** - le centre nerveux de l'application;
- **bin directory** - fichiers de fonctionnement interne;
- **package.json** - gestion des dépendances;
- **public directory** - location des images, scripts et feuilles de style **CSS**;
- **routes directory** - un *switchboard* qui permet de gérer les différentes requêtes;
- **views directory** - un endroit ou l'on construit le **HTML** qui sera présenté à l'utilisateur;

#### **Mise à jour des dépendances de l'application + Premier lancement**

Une fois le squelette de notre application généré, nous allons mettre à jour les dépendances requise pour notre application en modifiant le fichier `./app/package.json`. Dans notre cas nous avons besoin des paquets `mongodb` et `mongoose`.

```json
{
    "name": "app",
    "version": "0.0.0",
    "private": true,
    "scripts": {
        "start": "node ./bin/www"
    },
    "dependencies": {
        "cookie-parser": "~1.4.4",
        "debug": "~2.6.9",
        "express": "~4.16.1",
        "http-errors": "~1.6.3",
        "morgan": "~1.9.1",
        "pug": "2.0.0-beta11",
        "mongodb": "*",
        "mongoose": "*"
    }
}
```

Une fois les changements sauvegardés, on peut lancer la commande suivante depuis le dossier de notre application (`cd app/`) qui va permettre d'installer toutes les dépendances requises par notre application;

```bash
npm install
```

Une fois cela terminé, on peut lancer notre application avec la commande suivante qui nous donnera le résultat présent sur la prochaine image:

```bash
DEBUG=app:* npm start
```

![premier lancement de test](./img/premier_lancement_application_command.png)

Ensuite si l'on va à l'addresse http://localhost:3000/, on verra s'afficher ceci:

![affichage dans le navigateur](./img/premier_lancement_application_browser.png)

#### **Fonctionnement de l'application**

L'application fonctionne actuellement grâce au fichier `routes/index.js` qui permet de "router" les requêtes **HTTP** sur l'**URL** http://localhost:3000/.

```javascript
// routes/index.js
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
```

Ce fichier reçoit une requête depuis l'**URL** http://localhost:3000/, puis appelle la fonction `res.render`, qui prend deux arguements en paramètres. Premièrement, `index` qui permet de faire appel au *template* `views/index.pug`, et en second un objet **JSON** avec un nom (`title`) et une valeur (`'Express'`). C'est la valeur qui est affichée dans le navigateur grâce au fichier `views/index.pug`.

```pug
extends layout

block content
  h1= title
  p Welcome to #{title}
```

Dans un premier lieu on importe le contenu du fichier `views/layout.pug`, une fonctionnalité qui permet d'obtenir une structure de *template* consistante pour toute notre application. La ligne suivante permet de donner des instructions au moteur de *template* sur la localisation des éléments définis dans `views/layout.pug`. Ensuite la variable `title` définie dans le fichier `views/index.pug` est assignée à une balise `<h1>` et est aussi utilisé juste en dessous dans une balise `<p>`. Ce fichier permet donc de définir le contenu qui est affiché dans notre navigateur.

---

### Développement de la solution

Dans cette partie je vais décrire le fonctionnement de l'application d'un point de vue technique en présentant la mise en place de chaque fonctionnalité.

#### **Connection à MongoDB - Mongoose**

Dans un premier temps il nous faut récupérer les données présentes sur **MongoDB**. Pour cela on va utiliser **[Mongoose](https://mongoosejs.com/)**. On va donc éditer le fichier `router/index.js` et y apporter le code suivant:

```javascript
// router/index.js
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
```

Afin de nous connecter à **MongoDB** via **Mongoose**, il faut d'abord importer ce dernier grâce à la première ligne. Ensuite on se connecte à notre BDD grâce à la fonction `connect(uri(s), [options], [callback])`. `uris` permet de définir l'uri de connection à la BDD, `[options]` de définir les options de connection et `[callback]` de définir des fonctions de callback.

```javascript
/* Connection à MongoDB via Mongoose*/
mongoose.connect('mongodb://localhost/dataTourismDA3T', { useNewUrlParser: true }, function(error) {
    if (error)
        console.log(error);
});
```

Dans notre cas on se connect à notre BDD en local, on utilise le nouveau parser d'URL et on utilise un fonction de callback qui nous affiche une erreur si elle à lieu.

Ensuite on définit un schéma **Mongoose** qui permet de mapper une collection présente dans la BDD et de définir la disposition des documents qui seront retournés. Ici on indique que `type` accepte n'importe quel objet **JSON** en tant que valeur et que le nom du docuement doit être une string (pour le moment aucun nom n'est fournit dans les données).

```js
var Schema = mongoose.Schema;
var JsonSchema = new Schema({
    name: String,
    type: Schema.Types.Mixed
});
```

Et pour finir on définit simplement un modèle qui permet de 'mapper' une collection présente dans la BDD. Ici on mappe la collection `enriched_traces` ajoutée précédement.

```js
/* Définition du modèle Mongoose 
    permet de mapper une collection
    mongoose.model(<nom_du_modele>, <schema>, <collection_utilisée>)
*/
var Json = mongoose.model('JString', JsonSchema, 'enriched_traces');
```

> **Note:** On aurait appliqué la même logique pour les données des traces nues, soit en définissant une collection à part, soit en définissant une collection globale (ex: `traces`). La différenciation des deux sera expliquée dans la partie **Affichage des Tracés**;