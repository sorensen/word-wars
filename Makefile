
browser:
	./bin/build
	browserify public/views.js -o public/bundle.views.js

dox:
	dox-foundation --source lib --target docs

docs:
	docco -l ./docco.json ./lib/*.js -o ./docs2

.PHONY: browser docs