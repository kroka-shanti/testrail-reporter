/**
 * Created by Anastasia Oblomova on 21.10.15.
 */

var TestRail = require('node-testrail');
var async = require('async');
var _ = require('lodash');
var config = require('./config');
var testrail = new TestRail(config.url, config.username, config.password);
var projectId = config.projectID;

var currentSuite;
var currentRun;
var currentTests;
var currentTestID = 0;

module.exports = {

  //function update all cases in suite
  updateSuites: function (autotestSuite, callback) {

    testrail.getSuites(projectId, function (suits) { //find all suites in testrail
      suits = JSON.parse(suits);

      var trSuite = _.filter(suits, function (suite) {
        return suite.name === autotestSuite.title;
      })[0];

      if (trSuite) {
        currentSuite = trSuite; //save current suite

        testrail.getSections(projectId, trSuite.id, function (sections) { //find all sections
          sections = JSON.parse(sections);

          async.mapSeries(autotestSuite.suites, function (scenario, clb) {
            var trSection = _.filter(sections, function (section) {
              return section.name === scenario.title;
            })[0];

            if (trSection) {
              testrail.getCases(projectId, trSuite.id, trSection.id, function (cases) { //find all cases for this section
                cases = JSON.parse(cases);

                var caseTitles = _.map(cases, 'title');
                var testTitles = _.map(scenario.tests, 'title');

                if (caseTitles.toString() !== testTitles.toString()) {  //update cases if section exists and create cases if section not exists
                  testrail.deleteSection(trSection.id, function (res) { //delete section and create cases
                    addSectionAndCases(projectId, trSuite, scenario, function () {
                      console.log('Were added section and cases in TestRail');
                      clb(null);
                    });
                  });
                } else { //do nothing
                  console.log('Cases already updated');
                  clb(null);
                }
              });
            } else { //section not exists, add new sections and cases
              addSectionAndCases(projectId, trSuite, scenario, function () {
                clb(null);
              });
            }
          }, function (err, results) {
            callback(null);
          });
        });
      } else { //if suite not exists
        testrail.addSuite(projectId, autotestSuite.title, null, function (newSuite) {
          newSuite = JSON.parse(newSuite);

          currentSuite = newSuite; //save current suite

          async.mapSeries(autotestSuite.suites, function (scenario, clb) {
            addSectionAndCases(projectId, newSuite, scenario, function () {
              clb(null);
            });
          }, function (err, results) {
            console.log('Were added suite, section and cases in TestRail');
            callback();
          });
        })
      }
    });
  },

  //function for create new run
  createRun: function (callback) {
    testrail.addRun(projectId, currentSuite.id, currentSuite.name, null, null, function (newRun) {
      newRun = JSON.parse(newRun);
      currentRun = newRun;
      testrail.getTests(currentRun.id, function (tests) {
        currentTests = JSON.parse(tests);
        currentTestID = 0;
        callback();
      })
    })
  },

  //function for adds results for existing tests
  addResult: function (caseTitle, resultID, description, elapsed_time,  callback) {
    if (elapsed_time) elapsed_time = _.round(elapsed_time/1000).toString() + ' s';
    if (description) description = description.toString();
    if (currentTests[currentTestID].title === caseTitle) {
      testrail.addResult(currentTests[currentTestID].id, resultID, description, null, elapsed_time, null, null, function (result) {
        callback();
      })
    } else {
      console.error('No such test! (id:', currentTests[currentTestID].id, 'case title:', caseTitle);
      callback();
    }
    ++currentTestID;
  },

  closeRun: function (callback) {
    testrail.closeRun(currentRun.id, function (res) {
      callback();
    })
  }
};

//function for add new sections and cases
function addSectionAndCases(projectId, trSuite, scenario, callback) {
  testrail.addSection(projectId, trSuite.id, null, scenario.title, function (newSection) {
    newSection = JSON.parse(newSection);
    var testTitles = _.map(scenario.tests, 'title');

    return async.mapSeries(testTitles, function (title, cb) {
      testrail.addCase(newSection.id, title, null, projectId, null, null, null, function (res) {
        cb(null, JSON.parse(res));
      })
    }, function (err, results) {
      callback();
    });
  });
}