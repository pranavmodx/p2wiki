import React, { useState } from "react";
import { withRouter } from "react-router-dom";

const Search = ({ p2wiki }) => {
  let [query, setQuery] = useState("");
  let [title, setTitle] = useState("");
  let [result, setResult] = useState("");

  let media = {};
  let retryInterval = null;

  let getFromWiki = () => {
    if (query !== "") {
      if (
        p2wiki.requestArticle(query, function (res) {
          media = res.media;
          res.text.getBuffer((error, buffer) => {
            setTitle(res.Title);
            setResult(buffer.toString());
            if (error) {
              console.log(error);
            }
          });
        }) === false
      ) {
        console.log("No peer. Retrying in 3 seconds");
        clearInterval(retryInterval);
        retryInterval = setTimeout(getFromWiki, 3000);
      }
    }
  };

  let handleSubmit = (e) => {
    e.preventDefault();
    console.log(query);
    getFromWiki();
  };

  let handleChange = (e) => {
    setQuery(e.target.value);
  };

  let createMarkup = (html) => {
    var parser = new window.DOMParser();
    html = parser.parseFromString(html, "text/html");

    const images = html.querySelectorAll("a[class='image']");
    var filename;
    for (let i = 0; i < images.length; i++) {
      filename = new URL(images[i].href).pathname.slice(6);

      images[i].firstChild.src = "";

      if (media[filename]) {
        media[filename].renderTo(images[i].firstChild);
      }
    }

    return { __html: html.body.innerHTML };
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <ProxyButton />
        <div className="field">
          <div style={{ textAlign: "center" }} className="control">
            <input
              className="input is-rounded"
              id="query"
              type="Text"
              placeholder="🔍 Search for an article"
              onChange={handleChange}
              name="query"
              value={query}
            />
          </div>
        </div>
      </form>
      <div className="container mx-auto">
        <h1 className="title text-4xl">{title}</h1>
        <div dangerouslySetInnerHTML={createMarkup(result)} />
      </div>
    </div>
  );
};

const ProxyButton = withRouter(({ history }) => (
  <button
    className="button is-success is-outlined"
    style={{ marginBottom: "10px" }}
    type="button"
    onClick={() => {
      history.push("/proxy");
    }}
  >
    Be a Proxy Peer
  </button>
));

export default Search;
