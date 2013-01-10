
browser:
	./bin/build
	browserify public/views.js -o public/bundle.views.js

docs:
	dox-foundation --source lib --target docs

.PHONY: browser docs