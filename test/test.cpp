#include <QApplication>
#include <QMessageBox>

int main(int argc, char * argv[]) {
	QApplication app(argc, argv);
	QMessageBox::information(nullptr, QStringLiteral("It works!"), QStringLiteral("Hello World"));
	return 0;
}