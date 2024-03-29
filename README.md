# Polarity Jira Integration

The Polarity Jira integration allows Polarity to search Jira to return any Issues that are contained in Jira.

<img width="400" alt="Jira Issue Lookup Screenshot" src="./assets/overlay.png">

## Jira Integration Options

### Jira Base URL

URL used to access your instance of Jira.

### Jira UserName

Username used for individual to access Jira.

### API Token or Password

Jira API token (For Jira Cloud) or Jira Password (For Jira Server).

https://id.atlassian.com/manage/api-tokens

### Ignored Entities List
A comma delimited list entities you wish to ignore from search

### Ignore Regex Entities List',
A comma delimited list regular expressions for ignoring entities from search

### Projects to Search

A comma delimited list of project names to search. Project short names can be used in addition to the long names. Project names are not case-sensitive. If no value is provided, all accessible projects will be searched. This setting does not affect searches on Jira Issue Keys and is only used for searches on other entities (e.g., IP, domain, cve, etc.).

## Installation Instructions

Installation instructions for integrations are provided on the [PolarityIO GitHub Page](https://polarityio.github.io/).

## Polarity

Polarity is a memory-augmentation platform that improves and accelerates analyst decision making.  For more information about the Polarity platform please see:

https://polarity.io/
