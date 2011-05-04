(function() {

  var fs = require('fs');

  var defaults = {
    bufferSize: 8192,
    encoding: 'utf8',
    newlines: '\n'
  };

  function Queue() {
    var queue = [];
    var running = false;
    
    return {
      addTask: function(fn, that, args) {
        if (running) {
          queue.push({fn: fn, that: that, args: args});
        } else {
          running = true;
          fn.apply(that, args);
        }
      },
      doNext: function() {
        if (queue.length) {
          var task = queue.shift();
          task.fn.apply(task.that, task.args);
        } else {
          running = false;
        }
      }
    };
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

    var queue = Queue();

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

    function do_read(n, cb) {
      if (!stream.readable) {
        finish(new Error("Stream is not readable"));
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
          cb && cb(err);
        } else {
          cb && cb(null, data.join(''));
        }
        queue.doNext();
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
    };

    function do_readline(cb) {
      if (!stream.readable) {
        finish(new Error("Stream is not readable"));
      }

      var line = [];
      function finish(err) {
        if (err) {
          cb && cb(err);
        } else {
          cb && cb(null, line.join(''));
        }
        queue.doNext();
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
    };

    function do_seek(offset, whence, cb) {
      if (typeof cb === 'undefined') {
        cb = whence;
        whence = 0;
      }
      whence = whence || 0;

      function finish(err) {
        if (err) {
          cb && cb(err);
        } else {
          cb && cb(null);
        }
        queue.doNext();
      };

      fs.stat(path, function(err, stats) {
        if (err) {
          return finish(err);
        }

        var size = stats.blksize;
        var newPos;

        if (whence === 0) {
          newPos = offset;
        } else if (whence == 1) {
          newPos = offset + stream.tell();
        } else if (whence === 2) {
          newPos = size + offset;
        } else {
          return finish(new Error("Unknown whence"));
        }

        if (newPos < 0 || newPos >= size) {
          return finish(new Error("Invalid offset"));
        }

        filePos = newPos;
        foundEOF = false;

        bufferStart = 0;
        bufferEnd = 0;

        finish();
      });
    };

    var stream = {
      newlines: options.newlines || defaults.newlines,

      encoding: options.encoding || defaults.encoding,

      read: function(n, cb) {
        queue.addTask(do_read, this, arguments);
      },

      readline: function(cb) {
        queue.addTask(do_readline, this, arguments);
      },

      get readable() {
        return !stream.closed && !stream.EOF;
      },

      tell: function() {
        return filePos - (bufferEnd - bufferStart);
      },

      get seekable() {
        return !closed;
      },

      seek: function(offset, whence, cb) {
        queue.addTask(do_seek, this, arguments);
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
