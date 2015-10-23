/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base
  , cursor = Base.cursor
  , color = Base.color;
var testRailApi = require('./testRailApi');
var session = require('moonraker').session;

var skipTests = false;

/**
 * Expose `testrailreporter`.
 */

exports = module.exports = testrailreporter;

/**
 * Initialize a new `testrailreporter`.
 *
 * @param {Runner} runner
 * @api public
 */

function testrailreporter(runner) {
  Base.call(this, runner);

  var self = this
    , stats = this.stats
    , indents = 0
    , n = 0;

  function indent() {
    return Array(indents).join('  ')
  }

  runner.on('start', function(){
    console.log();
  });

  runner.on('suite', function(suite){

    if (indents === 1) {
      var finish = false;
      testRailApi.updateSuites(suite, function (){
        testRailApi.createRun(function () {
          finish = true;
        });
      });
      session.getDriver().wait( function () {
        return finish;
      });
    }
    ++indents;
    console.log(color('suite', '%s%s'), indent(), suite.title);
  });


  runner.on('suite end', function(suite){
    --indents;
    if (1 == indents) {
      console.log();
      skipTests = false;
    }
  });

  runner.on('pending', function(test){
    var fmt = indent() + color('pending', '  - %s');
    console.log(fmt, test.title);
  });

  runner.on('pass', function(test){

    if ('fast' == test.speed) {
      var fmt = indent()
        + color('checkmark', '  ' + Base.symbols.ok)
        + color('pass', ' %s ');
      cursor.CR();
      console.log(fmt, test.title);
    } else {
      var fmt = indent()
        + color('checkmark', '  ' + Base.symbols.ok)
        + color('pass', ' %s ')
        + color(test.speed, '(%dms)');
      cursor.CR();
      console.log(fmt, test.title, test.duration);
    }
    if (!skipTests) {
      var finish = false;
      var status;
      if (test.duration !== 0) {
        status = '1'; //passed
      } else {
        status = '2'; //blocked (skiped)
      }
      testRailApi.addResult(test.title, status, null, test.duration, function () {
        finish = true;
      });
      session.getDriver().wait( function () {
        return finish;
      });
    }
  });

  runner.on('fail', function(test, err){

    cursor.CR();
    console.log(indent() + color('fail', '  %d) %s'), ++n, test.title);

    if (test.err.code !== 13) {
      var finish = false;
      testRailApi.addResult(test.title, '5', err.stack, null, function () {
        finish = true;
      });
      session.getDriver().wait( function () {
        return finish;
      });
    } else {
      skipTests = true; //flag - miss all steps in section in pass method
    }
  });

  runner.on('end', self.epilogue.bind(self));
}

/**
 * Inherit from `Base.prototype`.
 */

testrailreporter.prototype.__proto__ = Base.prototype;


