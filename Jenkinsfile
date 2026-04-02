pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                echo "Building..."
            }
        }

        stage('Unit Test') {
            steps {
                echo "Testing..."
            }
        }
    }

    post {
        success {
            echo "Build Success"
        }
        failure {
            echo "Build Failed"
        }
    }
}