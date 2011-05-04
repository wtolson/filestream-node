(function() {

  var fs = require('fs');

  var defaults = {
    bufferSize: 8192,
    encoding: 'utf8',
    newlines: '\n'
  };
  
  function open(path, options, cb) {
    if (typeof cb === 'undefined') {
      cb = options;
      options = {};
    }

    var filePos = 0;
    var foundEOF = false;
    var closed = false;
    var file;

    var bufferStart = 0;
    var bufferEnd = 0;
    var bufferSize = options.bufferSize || defaults.bufferSize;
    var buffer = new Buffer(bufferSize);

    function fillBuffer(cb) {
      fs.read(file, buffer, 0, bufferSize, filePos, function(err, bytesRead) {
        filePos += bytesRead;
        bufferStart = 0;
        bufferEnd = bytesRead;
        if (bytesRead < bufferSize) {
          foundEOF = true;
        }

        cb(err);
      });
    };

    var stream = {
      newlines: options.newlines || defaults.newlines,

      encoding: options.encoding || defaults.encoding,

      read: function(n, cb) {
        if (!stream.readable) {
          throw new Error("Stream is not readable");
        }

        var data = [];

        if (typeof cb === 'undefined') {
          cb = n;
          n = null;
        }

        if (n < 0) {
          n = null;
        }

        function finish(err) {
          if (err) {
            return cb(err);
          } else {
            return cb(null, data.join(''));
          }
        };


        (function grabBuffer(err) {
          if (err) {
            return finish(err);
          }

          if (bufferStart == bufferEnd) {
            if (foundEOF) {
              return finish();
            }

            return fillBuffer(grabBuffer);
          }
          
          var frag = buffer.toString(stream.encoding, bufferStart, bufferEnd);
          if (n === null || n > frag.length) {
            data.push(frag);
            n -= frag.length;
            return fillBuffer(grabBuffer);
          } else {
            data.push(frag.substr(0,n));
            bufferStart += n;
            return finish();
          }
        })();

      },

      readline: function(cb) {
        if (!stream.readable) {
          throw new Error("Stream is not readable");
        }

        var line = [];
        function finish(err) {
          if (err) {
            return cb(err);
          } else {
            return cb(null, line.join(''));
          }
        };

        (function grabBuffer(err) {
          if (err) {
            return finish(err);
          }

          if (bufferStart == bufferEnd) {
            if (foundEOF) {
              return finish();
            }

            return fillBuffer(grabBuffer);
          }

          var frag = buffer.toString(stream.encoding, bufferStart, bufferEnd);
          var end = frag.indexOf(stream.newlines);
          if (end === -1) {
            line.push(frag);
            return fillBuffer(grabBuffer);
          } else {
            line.push(frag.substr(0,end));
            bufferStart += end+1;
            return finish();
          }
        })();

      },

      get readable() {
        return !stream.closed && !stream.EOF;
      },

      tell: function() {
        return filePos;
      },

      close: function(cb) {
        if (!closed) {
          closed = true;
          fs.close(file, cb);
        } else {
          throw new Error("File alread closed");
        }
      },

      get closed() {
        return closed;
      },

      get EOF() {
        return (bufferStart === bufferEnd && foundEOF);
      }
    };

    fs.open(path, 'r+', function(err, fd) {
      if (err) {
        return cb(err);
      }

      closed = false;
      file = fd;
      cb && cb(null, stream);
    });


  };

  module.exports = {
    open: open,
    get DEFAULT_BUFFER_SIZE() {
      return defaults.bufferSize;
    },
    get DEFAULT_ENCODING() {
      return defaults.encoding;
    },
    get DEFAULT_NEWLINES() {
      return defaults.newlines;
    }
  };

})();
