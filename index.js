/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base
  , cursor = Base.cursor
  , color = Base.color;
var testRailApi = require('./testRailApi');
var session = require('moonraker').session;

var skipTests = false;
var scenarioStatus = 'passed';

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
      }, 100000);
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
    if (2 == indents) {
      scenarioStatus = 'passed';
    }
  });

  runner.on('pending', function(test){
    var fmt = indent() + color('pending', '  - %s');
    console.log(fmt, test.title);
  });

  runner.on('pass', function(test){

    if (!skipTests) {
      var finish = false;
      var status;
      if (scenarioStatus === 'passed') {
        status = '1'; //passed
      } else {
        status = '2'; //blocked (skiped)
      }

      testRailApi.addResult(test.parent.title, test.title, status, null, test.duration, function () {
        finish = true;
      });
      session.getDriver().wait( function () {
        return finish;
      }, 20000);
    }

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
  });

  runner.on('fail', function(test, err){

    if (test.err.code !== 13) { //when test failed before start
      scenarioStatus = 'failed';
      var finish = false;
      testRailApi.addResult(test.parent.title, test.title, '5', err.stack, null, function () {
        finish = true;
      });
      session.getDriver().wait( function () {
        return finish;
      }, 20000);
    } else {
      skipTests = true; //flag - miss all steps in section in pass method
    }

    cursor.CR();
    console.log(indent() + color('fail', '  %d) %s'), ++n, test.title);
  });

  runner.on('end', function () {
    console.log('View results:', testRailApi.getViewResultsUrl());
    self.epilogue();
  });

}

/**
 * Inherit from `Base.prototype`.
 */

testrailreporter.prototype.__proto__ = Base.prototype;


