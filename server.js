'use strict';

require('dotenv').config();
require('ejs');

const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const methodOverride = require('method-override');


const app = express();
let port = process.env.PORT;
const client = new pg.Client(process.env.DATABASE_URL);

app.set('view engine', 'ejs');
app.use(express.static('./public'));
app.use(express.urlencoded({extended : true}));
app.use(methodOverride('_method'));

app.get('/', renderHomePage);
app.get('/search', renderSearchPage);
app.post('/searches', getBookData);
app.get('/books/:id', singleBookDetails);
app.post('/books', saveBooks);
app.put('/books/:id', updateBook);
app.delete('/books/:id', deleteBook);
app.get(`*`, handleError);

function getBookData (request, response) {
  const searchQuery = request.body.search[0];
  const searchType = request.body.search[1];
  let url = 'https://www.googleapis.com/books/v1/volumes?q=';
  if(searchType === 'title'){ url += `+intitle:${searchQuery}`}
  if(searchType === 'author'){ url += `+inauthor:${searchQuery}`}
  superagent.get(url)
    .then(data => {
      const bookArray = data.body.items;
      const finalBookArray = bookArray.map(book => new Book(book.volumeInfo));
      response.render('pages/searches/show', {finalBookArray: finalBookArray});
      console.log('the book should have a url', finalBookArray[0]);
    })
    .catch(() => {
      response.status(500).send('something went wrong with your superagent for showing api book data');
      console.log(url);
    })

}

function renderHomePage(request, response) {
  let sql = `SELECT * FROM books;`;
  client.query(sql)
    .then(result => {
      let allBooks = result.rows;
      response.status(200).render('pages/index.ejs', {bookList : allBooks});
    })
}

function renderSearchPage(request,response) {
  response.render('pages/searches/new.ejs');
}

function handleError (request, response) {
  response.status(404).render('error');
} 

function singleBookDetails(request, response) {
  const id = request.params.id;
	console.log('single book details: ', id);
	const sql = 'SELECT * FROM books WHERE id=$1;';
	const safeValues = [id];
	client.query(sql, safeValues).then((results) => {
		console.log(results.rows[0]);
		const myChosenBook = results.rows[0];
		response.render('pages/books/detail', { myChosenBook: myChosenBook });
	});
}

function saveBooks(request, response) {
  const {author, title, isbn, image_url, description} = request.body;
  console.log('in save books, this is the request body');
  console.log(request.body);
  const sql = 'INSERT INTO books (author, title, isbn, image_url, description) VALUES ($1, $2, $3, $4, $5) RETURNING id;';

  const safeValues = [author, title, isbn, image_url, description];
  client.query(sql, safeValues)
    .then(results => {
      const id = results.rows[0].id;
      console.log('results from sql', id);
      response.redirect(`books/${results.rows[0].id}`);
    })
}

function updateBook(request, response) {
  const id = request.params.id;
  console.log(request.body);
  const {author, title, isbn, image_url, description} = request.body;

  let sql = 'UPDATE books SET author=$1, title=$2, isbn=$3, image_url=$4, description=$5 WHERE id=$6;';
  let safeValues = [author, title, isbn, image_url, description, id];
  client.query(sql, safeValues);
  response.status(200).redirect(`/books/${id}`);
}

function deleteBook(request, response) {
  const id = request.params.id;
  let sql = 'DELETE FROM books WHERE id=$1;';
  let safeValues = [id];
  client.query(sql, safeValues);
  response.status(200).redirect('../');
}


function Book(volumeInfo) {
  this.image_url = volumeInfo.imageLinks ? volumeInfo.imageLinks.smallThumbnail.replace(/^http:\/\//i, 'https://'): `https://i.imgur.com/J5LVHEL.jpg`;
  this.title = volumeInfo.title ? volumeInfo.title: ` Title Unavailable!`;
  this.author = volumeInfo.authors ? volumeInfo.authors[0]: `Author Unavailable!`;
  this.description = volumeInfo.description ? volumeInfo.description: `Description Not Found!?`;
  this.isbn = volumeInfo.industryIdentifiers[0].identifier ? volumeInfo.industryIdentifiers[0].identifier: `No number available`;
}

client.connect()
  .then(() => {
    app.listen(port, () => {
      console.log('Server is listening on port', port);
    });
  })

