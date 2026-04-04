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
        stage('VA Scan - Trivy') {
            steps {
                sh '''
                trivy fs --exit-code 1 \
                --severity CRITICAL \
                --format table .
                '''
            }
        }
    }

    post {
        success {
            echo "Build Success great!!!"
        }
        failure {
            echo "Build Failed noob!!!"
        }
    }
}