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

    function resolve() {
      var args = Array.prototype.slice.call(arguments);

      var cb = args.shift();
      if (typeof cb === "function") {
        cb.apply(null, args);
      }
      
      if (queue.length) {
        var task = queue.shift();
        task.fn.apply(task.that, task.args);
      } else {
        running = false;
      }
    };
    
    return {
      addTask: function(fn, that, args, cb) {
        args = Array.prototype.slice.call(args);
        args.unshift(resolve.bind(null,cb));
        if (running) {
          queue.push({fn: fn, that: that, args: args});
        } else {
          running = true;
          fn.apply(that, args);
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

    function do_read(resolve, n) {
      if (!stream.readable) {
        resolve(new Error("Stream is not readable"));
        return;
      }

      if (n < 0) {
        n = null;
      }
      n = n || null;

      var data = [];

      (function grabBuffer(err) {
        if (err) {
          resolve(err);
          return;
        } else if (bufferStart == bufferEnd) {
          if (foundEOF) {
            resolve(null, data.join(''));
            return;
          } else {
            fillBuffer(grabBuffer);
            return;
          }
        } else {
          var frag = buffer.toString(stream.encoding, bufferStart, bufferEnd);
          if (n === null || n > frag.length) {
            data.push(frag);
            n -= frag.length;
            fillBuffer(grabBuffer);
            return;
          } else {
            data.push(frag.substr(0,n));
            bufferStart += n;
            resolve(null, data.join(''));
            return;
          }
        }
      })();
    };

    function do_readline(resolve) {
      if (!stream.readable) {
        resolve(new Error("Stream is not readable"));
        return;
      }

      var line = [];

      (function grabBuffer(err) {
        if (err) {
          resolve(err);
          return;
        }

        if (bufferStart == bufferEnd) {
          if (foundEOF) {
            resolve(null, line.join(''));
            return; 
          }

          fillBuffer(grabBuffer);
          return;
        }

        var frag = buffer.toString(stream.encoding, bufferStart, bufferEnd);
        var end = frag.indexOf(stream.newlines);
        if (end === -1) {
          line.push(frag);
          fillBuffer(grabBuffer);
          return;
        } else {
          line.push(frag.substr(0,end));
          bufferStart += end+1;
          resolve(null, line.join(''));
          return;
        }
      })();
    };

    function do_seek(resolve, offset, whence) {
      whence = whence || 0;

      fs.stat(path, function(err, stats) {
        if (err) {
          resolve(err);
          return;
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
          resolve(new Error("Unknown whence"));
          return;
        }

        if (newPos < 0 || newPos >= size) {
          resolve(new Error("Invalid offset"));
          return;
        }

        filePos = newPos;
        foundEOF = false;

        bufferStart = 0;
        bufferEnd = 0;

        resolve();
      });
    };

    var stream = {
      newlines: options.newlines || defaults.newlines,

      encoding: options.encoding || defaults.encoding,

      read: function(n, cb) {
        if (typeof cb == "undefined" && typeof n == "function") {
          cb = n;
          n = null;
        }
        queue.addTask(do_read, this, [n], cb);
      },

      readline: function(cb) {
        queue.addTask(do_readline, this, [], cb);
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
        if (typeof cb == "undefined" && typeof whence == "function") {
          var temp = cb;
          cb = whence;
          whence = temp;
        }
        queue.addTask(do_seek, this, [offset, whence], cb);
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
      if (typeof cb === "function") {
        cb(null, stream);
      }
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
