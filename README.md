# testrail-reporter

This reporter update test suites in TestRail using features files. And then add results for each case.

#Config
Add TestRail settings to config.json in your tests folder. For example:

 "testrailReporter": {
    "url": "https://myproject.testrail.net/",
    "username": "username@myproject.com",
    "password": "password",
    "projectID": "6"
  }


#NOTE!
For use this reporter you need use moonraker framework for your tests.
Based on spec reporter.

