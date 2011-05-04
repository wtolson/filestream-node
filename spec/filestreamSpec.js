var filestream = require("../filestream.js");


describe('filestream', function() {

  it('has open function', function() {
    expect(filestream.open).toBeDefined();
  });

});

describe('open', function() {

  it('should be open', function() {
    filestream.open('test.txt', function(err, stream) {
      expect(err).toBeNull();
      expect(stream).toBeDefined();
      expect(stream.closed).toBeFalsy();
      asyncSpecDone();
    });

    asyncSpecWait();
  });


});
